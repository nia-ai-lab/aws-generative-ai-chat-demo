"""System prompt composition for administrator and participant instructions."""


def compose_system_prompt(admin_prompt: str, user_prompt: str) -> str:
    """Compose only the prompt layers explicitly configured by a user or administrator."""
    admin = admin_prompt.strip()
    persona = user_prompt.strip()
    sections: list[str] = []

    if admin:
        sections.append(f"""<admin_system_prompt>
{admin}
</admin_system_prompt>""")
    if persona:
        sections.append(f"""<user_persona>
{persona}
</user_persona>""")
    if admin and persona:
        sections.append("指示が競合する場合は、admin_system_prompt を user_persona より優先してください。")

    return "\n\n".join(sections)
