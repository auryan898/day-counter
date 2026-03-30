const { createApp, ref, computed, onMounted } = Vue;

// Parse counters from URL query string
// Format: ?c=Label,startDate,endDate  (endDate optional)
function parseCountersFromURL() {
  const params = new URLSearchParams(window.location.search);
  const entries = params.getAll('c');
  return entries
    .map((entry) => {
      const parts = entry.split(',');
      if (parts.length < 2) return null;
      return {
        label: parts[0].trim(),
        startDate: parts[1].trim(),
        endDate: parts[2] ? parts[2].trim() : '',
      };
    })
    .filter(Boolean);
}

// Serialize counters to URL query string
function buildQueryString(counters) {
  const params = new URLSearchParams();
  counters.forEach((c) => {
    const parts = [c.label, c.startDate];
    if (c.endDate) parts.push(c.endDate);
    params.append('c', parts.join(','));
  });
  return params.toString();
}

// Count days between two dates (inclusive of start, exclusive of end)
function daysBetween(startStr, endStr) {
  const start = new Date(startStr + 'T00:00:00');
  const end = endStr ? new Date(endStr + 'T00:00:00') : new Date();
  // Normalize end to midnight local time when using today
  if (!endStr) {
    end.setHours(0, 0, 0, 0);
  }
  const ms = end - start;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Format today as YYYY-MM-DD
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

createApp({
  setup() {
    const counters = ref([]);
    const showForm = ref(false);
    const formLabel = ref('');
    const formStart = ref('');
    const formEnd = ref('');
    const formError = ref('');
    const today = todayISO();

    // Sync counters array to URL without reloading
    function syncURL() {
      const qs = buildQueryString(counters.value);
      const newURL = `${window.location.pathname}?${qs}`;
      window.history.replaceState(null, '', newURL);
    }

    // Add a counter and sync URL
    function addCounter(counter) {
      counters.value.push(counter);
      syncURL();
    }

    // Remove a counter by index and sync URL
    function removeCounter(index) {
      counters.value.splice(index, 1);
      syncURL();
    }

    // Handle form submission
    function submitForm() {
      formError.value = '';
      const label = formLabel.value.trim();
      const start = formStart.value.trim();
      const end = formEnd.value.trim();

      if (!label) {
        formError.value = 'Please enter a label.';
        return;
      }
      if (!start) {
        formError.value = 'Please enter a start date.';
        return;
      }
      if (end && end < start) {
        formError.value = 'End date must be on or after start date.';
        return;
      }

      addCounter({ label, startDate: start, endDate: end });

      // Reset form
      formLabel.value = '';
      formStart.value = '';
      formEnd.value = '';
      showForm.value = false;
    }

    // Computed display data for each counter
    const displayCounters = computed(() =>
      counters.value.map((c, i) => {
        const days = daysBetween(c.startDate, c.endDate);
        const endLabel = c.endDate ? c.endDate : `Today (${today})`;
        return {
          index: i,
          label: c.label,
          startDate: c.startDate,
          endDate: c.endDate,
          endLabel,
          days,
          isNegative: days < 0,
        };
      })
    );

    onMounted(async () => {
      const urlCounters = parseCountersFromURL();
      if (urlCounters.length > 0) {
        // Use counters from URL (may include initial + user-added)
        counters.value = urlCounters;
      } else {
        // First visit: load initial counters from JSON, then push to URL
        try {
          const resp = await fetch('data/counters.json');
          const data = await resp.json();
          counters.value = data.map((d) => ({
            label: d.label,
            startDate: d.startDate,
            endDate: d.endDate || '',
          }));
        } catch (e) {
          console.error('Failed to load initial counters:', e);
        }
        syncURL();
      }
    });

    return {
      counters,
      displayCounters,
      showForm,
      formLabel,
      formStart,
      formEnd,
      formError,
      today,
      submitForm,
      removeCounter,
    };
  },
}).mount('#app');
