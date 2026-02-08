"use client";

import { Input } from "@/components/ui/input";

interface PeriodInputProps {
	value: string;
	onChange: (value: string) => void;
}

export function PeriodInput({ value, onChange }: PeriodInputProps) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="text-sm font-medium">Periodo</span>
			<Input
				type="month"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</label>
	);
}
