export function isCostaRicaIndependenceSeason() {
  const date = new Date();

  return (
    date.getMonth() === 8 &&
    date.getDate() >= 1 &&
    date.getDate() <= 30
  );
}
