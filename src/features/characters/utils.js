export function formatNumber(value) {
  return new Intl.NumberFormat("th-TH").format(Number(value) || 0);
}

export function filterCharacters(
  characters,
  search,
  roleFilter = "all",
  positionFilter = "all",
) {
  const keyword = search.trim().toLocaleLowerCase("th");

  return characters.filter((character) => {
    const searchableText = [
      character.character_name,
      character.player_name,
      character.username,
      character.role,
      character.position,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("th");

    const matchesRole =
      roleFilter === "all" || character.role === roleFilter;
    const matchesPosition =
      positionFilter === "all" || character.position === positionFilter;

    return (
      matchesRole &&
      matchesPosition &&
      (!keyword || searchableText.includes(keyword))
    );
  });
}
