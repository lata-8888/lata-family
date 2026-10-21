-- Tasks mit Registern «Offen | Erledigt | Andere»: je zugeteilter Person ein Aktiv-Flag (Erledigen deaktiviert den Task für diese Person)
alter table public."lata-task_assignees" add column if not exists active boolean not null default true;
