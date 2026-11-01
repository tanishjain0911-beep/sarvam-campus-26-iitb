# Executor rules

Codex manages Suno. OpenCode and Antigravity implement scoped tasks. PLAN.md is the source of project context.

- Do exactly what briefs/<id>.md asks. No additional features or refactors.
- Touch only files listed in the brief. Report any need to change other files.
- Do not edit PLAN.md, TASKS.md, AGENTS.md, or other workers' files.
- Prefer simple, readable code; explain only tricky logic.
- Never read, print, commit, or copy secrets. App code reads SARVAM_API_KEY from the environment. List variable names in .env.example.
- Do not alter authentication, permissions, Git configuration, or remotes.
- Run the brief's Done when checks unless the manager assigns file tools only.
- Do not commit, push, merge, deploy, contact people, or install packages. The manager handles commits and asks before external publication.
- End with: (1) files changed (2) verification performed (3) unfinished items or questions.

