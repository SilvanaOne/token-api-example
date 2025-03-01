import {
  uniqueNamesGenerator,
  names,
  adjectives,
  colors,
  animals,
  countries,
  languages,
} from "unique-names-generator";
export { randomName, randomText, randomImage, randomBanner };

function randomName(): string {
  let counter = 0;
  while (true) {
    const name = uniqueNamesGenerator({
      dictionaries: [names],
      length: 1,
    });
    if (name.length <= 30) return name;
    counter++;
    if (counter > 1000) throw new Error("Too many retries");
  }
}

function randomText(): string {
  const length = Math.floor(Math.random() * 20) + 1;
  const words = Array.from({ length }, () =>
    uniqueNamesGenerator({
      dictionaries: [
        ...[adjectives, names, colors, animals, countries, languages].sort(
          () => Math.random() - 0.5
        ),
      ],
      length: 6,
      separator: " ",
    })
  );
  const text = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(". ");
  return text;
}

function randomImage(): string {
  return `https://picsum.photos/seed/${Math.floor(
    Math.random() * 10000000
  )}/540/670`;
}

function randomBanner(): string {
  return `https://picsum.photos/seed/${Math.floor(
    Math.random() * 10000000
  )}/1920/300`;
}
