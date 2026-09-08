(() => {
  const back = document.getElementById("settingsBackBtn");
  const auto = document.getElementById("nativeAutoSaveToggle");
  const reminder = document.getElementById("nativeSaveReminderToggle");
  const interval = document.getElementById("nativeSaveIntervalSelect");

  function hydrate() {
    const settings = DenXProjectStore.getSettings();
    if (auto) auto.checked = !!settings.autoSave;
    if (reminder) reminder.checked = !!settings.saveReminder;
    if (interval) interval.value = String(settings.intervalMinutes || 10);
  }

  function persist() {
    DenXProjectStore.saveSettings({
      autoSave: !!auto?.checked,
      saveReminder: !!reminder?.checked,
      intervalMinutes: Number(interval?.value || 10)
    });
  }

  [auto, reminder, interval].forEach(control => {
    control?.addEventListener("change", persist);
  });

  back?.addEventListener("click", () => {
    persist();
    const target = sessionStorage.getItem("denx.settingsReturn") || "index.html";
    sessionStorage.removeItem("denx.settingsReturn");
    window.location.href = target;
  });

  hydrate();
})();
