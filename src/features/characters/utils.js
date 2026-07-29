export function formatNumber(value) {
  return new Intl.NumberFormat("th-TH").format(Number(value) || 0);
}

export function filterCharacters(characters, status, search) {
  const keyword = search.trim().toLocaleLowerCase("th");

  return characters.filter((character) => {
    const matchesStatus = status === "ทั้งหมด" || character.status === status;
    const searchableText = [
      character.character_name,
      character.player_name,
      character.username,
    ]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("th");

    return matchesStatus && (!keyword || searchableText.includes(keyword));
  });
}
