export function startApiPlaceholder(): void {
  console.log("API workspace bootstrap placeholder");
}

if (process.env.NODE_ENV !== "test") {
  startApiPlaceholder();
}
