declare module "mammoth/mammoth.browser" {
  export type MammothMessage = {
    type: string;
    message: string;
  };

  export type MammothImage = {
    contentType: string;
    readAsBase64String: () => Promise<string>;
  };

  export type MammothResult = {
    value: string;
    messages: MammothMessage[];
  };

  export const images: {
    imgElement: (
      handler: (image: MammothImage) => Promise<Record<string, string>>
    ) => unknown;
  };

  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer },
    options?: {
      convertImage?: unknown;
      styleMap?: string[];
    }
  ): Promise<MammothResult>;
}
