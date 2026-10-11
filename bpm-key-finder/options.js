const input = document.getElementById("key");
const ok = document.getElementById("ok");

browser.storage.local.get("apiKey").then(({ apiKey }) => { input.value = apiKey || ""; });

document.getElementById("save").addEventListener("click", async () => {
  await browser.storage.local.set({ apiKey: input.value.trim() });
  ok.textContent = "Opgeslagen ✓";
  setTimeout(() => (ok.textContent = ""), 2000);
});
