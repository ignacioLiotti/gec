import { Fragment, type ReactNode } from "react";

/**
 * Minimal markdown renderer for chat responses: paragraphs, headings, lists,
 * bold/italic/inline-code. Builds React nodes directly (no HTML injection).
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	let index = 0;
	while ((match = pattern.exec(text)) !== null) {
		if (match.index > lastIndex) {
			nodes.push(<Fragment key={`${keyPrefix}-t${index++}`}>{text.slice(lastIndex, match.index)}</Fragment>);
		}
		const token = match[0];
		if (token.startsWith("**")) {
			nodes.push(
				<strong key={`${keyPrefix}-b${index++}`} className="font-semibold text-stone-900">
					{token.slice(2, -2)}
				</strong>,
			);
		} else if (token.startsWith("`")) {
			nodes.push(
				<code
					key={`${keyPrefix}-c${index++}`}
					className="rounded bg-stone-200/60 px-1 py-0.5 font-mono text-[0.85em] text-stone-800"
				>
					{token.slice(1, -1)}
				</code>,
			);
		} else {
			nodes.push(
				<em key={`${keyPrefix}-i${index++}`}>{token.slice(1, -1)}</em>,
			);
		}
		lastIndex = match.index + token.length;
	}
	if (lastIndex < text.length) {
		nodes.push(<Fragment key={`${keyPrefix}-t${index++}`}>{text.slice(lastIndex)}</Fragment>);
	}
	return nodes;
}

type Block =
	| { kind: "paragraph"; text: string }
	| { kind: "heading"; level: number; text: string }
	| { kind: "ul"; items: string[] }
	| { kind: "ol"; items: string[] };

function parseBlocks(markdown: string): Block[] {
	const lines = markdown.replace(/\r\n/g, "\n").split("\n");
	const blocks: Block[] = [];
	let paragraph: string[] = [];

	const flushParagraph = () => {
		if (paragraph.length > 0) {
			blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
			paragraph = [];
		}
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			flushParagraph();
			continue;
		}
		const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
		if (headingMatch) {
			flushParagraph();
			blocks.push({ kind: "heading", level: headingMatch[1].length, text: headingMatch[2] });
			continue;
		}
		const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
		if (ulMatch) {
			flushParagraph();
			const last = blocks[blocks.length - 1];
			if (last?.kind === "ul") last.items.push(ulMatch[1]);
			else blocks.push({ kind: "ul", items: [ulMatch[1]] });
			continue;
		}
		const olMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
		if (olMatch) {
			flushParagraph();
			const last = blocks[blocks.length - 1];
			if (last?.kind === "ol") last.items.push(olMatch[1]);
			else blocks.push({ kind: "ol", items: [olMatch[1]] });
			continue;
		}
		paragraph.push(trimmed);
	}
	flushParagraph();
	return blocks;
}

export function ChatMarkdown({ text }: { text: string }) {
	const blocks = parseBlocks(text);
	return (
		<div className="space-y-3 text-[15px] leading-7 text-stone-800">
			{blocks.map((block, blockIndex) => {
				const key = `block-${blockIndex}`;
				if (block.kind === "heading") {
					return (
						<p key={key} className="pt-1 text-[15px] font-semibold text-stone-900">
							{renderInline(block.text, key)}
						</p>
					);
				}
				if (block.kind === "ul") {
					return (
						<ul key={key} className="space-y-1.5 pl-1">
							{block.items.map((item, itemIndex) => (
								<li key={`${key}-${itemIndex}`} className="flex gap-2.5">
									<span className="mt-[11px] size-[5px] shrink-0 rounded-full bg-stone-400" />
									<span>{renderInline(item, `${key}-${itemIndex}`)}</span>
								</li>
							))}
						</ul>
					);
				}
				if (block.kind === "ol") {
					return (
						<ol key={key} className="space-y-1.5 pl-1">
							{block.items.map((item, itemIndex) => (
								<li key={`${key}-${itemIndex}`} className="flex gap-2.5">
									<span className="w-5 shrink-0 text-right font-medium tabular-nums text-stone-500">
										{itemIndex + 1}.
									</span>
									<span>{renderInline(item, `${key}-${itemIndex}`)}</span>
								</li>
							))}
						</ol>
					);
				}
				return <p key={key}>{renderInline(block.text, key)}</p>;
			})}
		</div>
	);
}
