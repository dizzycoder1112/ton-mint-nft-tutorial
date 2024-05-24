export function getRandomNumber() {
  const now = new Date(); // Get the current date and time
  const uniqueTime = now.getTime(); // Milliseconds since the Unix Epoch (January 1, 1970)
  const random = Math.random(); // Get a random number between 0 (inclusive) and 1 (exclusive)

  // Combine these two to create a random number based on current time
  return uniqueTime * random;
}

function randomFromSeed(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateRandomInRange(min: number, max: number) {
  const now = new Date();
  const seed = now.getTime();
  const random = randomFromSeed(seed);

  return Math.floor(random * (max - min + 1) + min);
}
