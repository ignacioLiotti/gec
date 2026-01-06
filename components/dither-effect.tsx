"use client"

import { forwardRef, useMemo } from "react"
import { Effect, BlendFunction } from "postprocessing"
import { Uniform, Vector2 } from "three"

const fragmentShader = `
uniform vec2 resolution;
uniform float intensity;
uniform vec3 color1;
uniform vec3 color2;
uniform float brightness;
uniform float contrast;
uniform float pixelSize;
uniform float colorSteps;
uniform float gamma;

// Efficient 8x8 Bayer matrix using bit manipulation
float bayer8x8(vec2 position) {
  ivec2 p = ivec2(mod(position, 8.0));
  int x = p.x;
  int y = p.y;

  // Compute Bayer value using recursive pattern
  int value = 0;
  value += ((x ^ y) & 1) << 0;
  value += (((x >> 1) ^ (y >> 1)) & 1) << 1;
  value += (((x >> 2) ^ (y >> 2)) & 1) << 2;
  value += ((y & 1) << 3);
  value += (((y >> 1) & 1) << 4);
  value += (((y >> 2) & 1) << 5);

  return float(value) / 64.0;
}

// 4x4 Bayer matrix - more visible dithering pattern
float bayer4x4(vec2 position) {
  ivec2 p = ivec2(mod(position, 4.0));

  // Classic 4x4 Bayer matrix values
  const float matrix[16] = float[16](
    0.0/16.0,  8.0/16.0,  2.0/16.0, 10.0/16.0,
    12.0/16.0, 4.0/16.0, 14.0/16.0,  6.0/16.0,
    3.0/16.0, 11.0/16.0,  1.0/16.0,  9.0/16.0,
    15.0/16.0, 7.0/16.0, 13.0/16.0,  5.0/16.0
  );

  return matrix[p.y * 4 + p.x];
}

// Perceptual luminance
float getLuminance(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

// Gamma correction for perceptually correct dithering
vec3 toLinear(vec3 color, float g) {
  return pow(color, vec3(g));
}

vec3 toGamma(vec3 color, float g) {
  return pow(color, vec3(1.0 / g));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // Calculate pixelated coordinates
  vec2 pixelatedUV = uv;
  vec2 pixelCoord = floor(uv * resolution);

  if (pixelSize > 1.0) {
    vec2 blockSize = pixelSize / resolution;
    pixelatedUV = floor(uv / blockSize) * blockSize + blockSize * 0.5;
    pixelCoord = floor(pixelatedUV * resolution / pixelSize);
  }

  // Sample pixel
  vec4 sampled = texture(inputBuffer, pixelatedUV);
  vec3 color = sampled.rgb;

  // Apply gamma correction for perceptually correct dithering
  color = toLinear(color, gamma);

  // Apply brightness and contrast
  color = (color - 0.5) * (1.0 + contrast) + 0.5 + brightness;
  color = clamp(color, 0.0, 1.0);

  // Get luminance for dithering
  float lum = getLuminance(color);

  // Get Bayer dither value (use 4x4 for more visible pattern)
  float bayerValue = bayer4x4(pixelCoord);

  // Apply dithering with intensity control
  // intensity 0 = no dithering, 1 = full dithering effect
  float ditherOffset = (bayerValue - 0.5) * intensity;
  float ditheredLum = lum + ditherOffset;

  // Quantize to color steps
  float quantized;
  if (colorSteps <= 2.0) {
    // Two-color dithering
    quantized = step(0.5, ditheredLum);
  } else {
    // Multi-level dithering
    float levels = colorSteps - 1.0;
    quantized = floor(ditheredLum * levels + 0.5) / levels;
  }
  quantized = clamp(quantized, 0.0, 1.0);

  // Interpolate between colors
  vec3 finalColor = mix(color1, color2, quantized);

  // Convert back from linear
  finalColor = toGamma(finalColor, gamma);

  outputColor = vec4(finalColor, sampled.a);
}
`

// Helper function to convert hex to RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [1, 1, 1]
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ]
}

class DitherEffectImpl extends Effect {
  constructor(options: {
    intensity?: number
    color1?: string
    color2?: string
    brightness?: number
    contrast?: number
    pixelSize?: number
    colorSteps?: number
    gamma?: number
    resolution?: Vector2
  }) {
    const {
      intensity = 0.8,
      color1 = "#000000",
      color2 = "#FFFFFF",
      brightness = 0.0,
      contrast = 0.5,
      pixelSize = 1.0,
      colorSteps = 2.0,
      gamma = 2.2,
      resolution = new Vector2(1920, 1080),
    } = options

    const rgb1 = hexToRgb(color1)
    const rgb2 = hexToRgb(color2)

    const uniforms = new Map<string, Uniform<unknown>>()
    uniforms.set("resolution", new Uniform(resolution))
    uniforms.set("intensity", new Uniform(intensity))
    uniforms.set("color1", new Uniform([rgb1[0], rgb1[1], rgb1[2]]))
    uniforms.set("color2", new Uniform([rgb2[0], rgb2[1], rgb2[2]]))
    uniforms.set("brightness", new Uniform(brightness))
    uniforms.set("contrast", new Uniform(contrast))
    uniforms.set("pixelSize", new Uniform(pixelSize))
    uniforms.set("colorSteps", new Uniform(colorSteps))
    uniforms.set("gamma", new Uniform(gamma))

    super("DitherEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms,
    })
  }
}

type DitherEffectProps = {
  /** Dithering strength (0 = none, 1 = strong). Default: 0.8 */
  intensity?: number
  /** Dark color in hex. Default: "#000000" */
  color1?: string
  /** Light color in hex. Default: "#FFFFFF" */
  color2?: string
  /** Brightness adjustment (-1 to 1). Default: 0 */
  brightness?: number
  /** Contrast adjustment (-1 to 1). Default: 0.5 */
  contrast?: number
  /** Pixel block size for chunky effect. Default: 1 (no pixelation) */
  pixelSize?: number
  /** Number of color levels (2 = classic dither, more = smoother gradients). Default: 2 */
  colorSteps?: number
  /** Gamma correction for perceptual accuracy. Default: 2.2 */
  gamma?: number
  /** Render resolution. Default: 1920x1080 */
  resolution?: Vector2
}

export const DitherEffect = forwardRef<DitherEffectImpl, DitherEffectProps>((props, ref) => {
  const {
    intensity = 0.8,
    color1 = "#000000",
    color2 = "#FFFFFF",
    brightness = 0.0,
    contrast = 0.5,
    pixelSize = 1.0,
    colorSteps = 2.0,
    gamma = 2.2,
    resolution = new Vector2(1920, 1080),
  } = props

  const effect = useMemo(
    () => new DitherEffectImpl({
      intensity,
      color1,
      color2,
      brightness,
      contrast,
      pixelSize,
      colorSteps,
      gamma,
      resolution
    }),
    [intensity, color1, color2, brightness, contrast, pixelSize, colorSteps, gamma, resolution]
  )

  return <primitive ref={ref} object={effect} dispose={null} />
})

DitherEffect.displayName = "DitherEffect"

