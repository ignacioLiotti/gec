// import {
//   Body,
//   Container,
//   Head,
//   Html,
//   Preview,
//   Section,
//   Text,
// } from "@react-email/components";

import React from "react";

export interface ObraCompletionEmailProps {
  recipientName?: string | null;
  obras: { name: string; percentage: number }[];
  introMessage?: string;
}

export default function ObraCompletionEmail({
  recipientName,
  obras,
  introMessage,
}: ObraCompletionEmailProps) {
  const names = obras.map((obra) => obra.name).join(", ");
  const message =
    introMessage ??
    "Te informamos que las siguientes obras alcanzaron el 100% de avance:";
  // return (
  //   <Html>
  //     <Head />
  //     <Preview>Obra completada: {names}</Preview>
  //     <Body style={bodyStyle}>
  //       <Container style={containerStyle}>
  //         <Section>
  //           <Text style={headingStyle}>
  //             {recipientName ? `Hola ${recipientName},` : "Hola,"}
  //           </Text>
  //           <Text style={textStyle}>
  //             {message}
  //           </Text>
  //           <ul style={listStyle}>
  //             {obras.map((obra) => (
  //               <li key={obra.name} style={listItemStyle}>
  //                 <strong>{obra.name}</strong> ({obra.percentage}%)
  //               </li>
  //             ))}
  //           </ul>
  //           <Text style={textStyle}>
  //             ¡Felicitaciones por el progreso! Si necesitás revisar más
  //             detalles, podés hacerlo desde el panel de obras.
  //           </Text>
  //           <Text style={textStyle}>Saludos,</Text>
  //           <Text style={signatureStyle}>Equipo Multi-Tenant</Text>
  //         </Section>
  //       </Container>
  //     </Body>
  //   </Html>
  return message;
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

const containerStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "24px",
  margin: "24px auto",
  maxWidth: "520px",
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
};

const headingStyle: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: 600,
  color: "#111827",
  marginBottom: "12px",
};

const textStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#374151",
  lineHeight: "1.6",
  marginBottom: "12px",
};

const listStyle: React.CSSProperties = {
  margin: "0 0 16px",
  paddingLeft: "20px",
  color: "#1f2937",
  fontSize: "14px",
};

const listItemStyle: React.CSSProperties = {
  marginBottom: "6px",
};

const signatureStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#111827",
  fontWeight: 600,
  marginTop: "8px",
};
