-- Add configuration fields for obra completion workflows

alter table public.obras
	add column if not exists on_finish_first_message text,
	add column if not exists on_finish_second_message text,
	add column if not exists on_finish_second_send_at timestamptz;

create index if not exists obras_on_finish_second_send_at_idx
	on public.obras (on_finish_second_send_at);
