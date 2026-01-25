import { NextResponse } from "next/server";

export async function GET() {
  const isDev = process.env.NODE_ENV === "development";
  const color = isDev ? "#9333ea" : "#ea580c"; // Purple for dev, orange for prod

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" fill="${color}" rx="6"/>
      <circle cx="16" cy="16" r="10" fill="#ffffff" opacity="0.9"/>
    </svg>
  `.trim();

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

