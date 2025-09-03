// URL del CSV de Google Sheets
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR-QYY0OvN7AVVK0UhEEveCHNjeeIueMIdWCY6HwObRuo3m5nuCeRWHxfNcHsuDZVdjeNL2uYH_PzFM/pub?output=csv";

// Variable global para almacenar los eventos
let events = [];

// Función para cargar los datos desde el CSV
async function loadCSV() {
  const loadingMessage = document.getElementById("loading-message");
  loadingMessage.textContent = "Cargando datos desde Google Sheets...";

  try {
    const response = await fetch(CSV_URL);
    const csvData = await response.text();
    Papa.parse(csvData, {
      header: true,
      complete: function(results) {
        events = results.data;
        loadTable();
        initCharts();
        loadingMessage.textContent = "Datos cargados correctamente.";
      },
      error: function(error) {
        loadingMessage.textContent = "Error al cargar los datos: " + error.message;
      }
    });
  } catch (error) {
    loadingMessage.textContent = "Error al conectar con Google Sheets: " + error.message;
  }
}

// Función para cargar la tabla (solo últimos 10 eventos)
function loadTable() {
  const tableBody = document.getElementById("events-body");
  tableBody.innerHTML = "";
  const lastEvents = events.slice(-10); // Solo últimos 10
  lastEvents.forEach(event => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${event.Fecha}</td>
      <td>${event.Hora}</td>
      <td>${event.Evento}</td>
      <td>${calculateDuration(event.Fecha, event.Hora, event.Evento)}</td>
    `;
    tableBody.appendChild(row);
  });
}

// Función para calcular duración
function calculateDuration(date, time, type) {
  if (type === "Volvió") {
    const start = events.find(e => e.Fecha === date && e.Evento === "Se cortó");
    if (start) {
      const startTime = new Date(`${date}T${start.Hora}`);
      const endTime = new Date(`${date}T${time}`);
      const diff = (endTime - startTime) / (1000 * 60);
      return `${Math.floor(diff / 60)}h ${diff % 60}m`;
    }
  }
  return "-";
}

// Función para inicializar gráficos
function initCharts() {
  // Gráfico de barras (frecuencia por fecha)
  const barCtx = document.getElementById("bar-chart").getContext("2d");
  new Chart(barCtx, {
    type: "bar",
    data: {
      labels: [...new Set(events.map(e => e.Fecha))],
      datasets: [{
        label: "Frecuencia de Cortes",
        data: [...new Set(events.map(e => e.Fecha))].map(date =>
          events.filter(e => e.Fecha === date && e.Evento === "Se cortó").length
        ),
        backgroundColor: "#4CAF50",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  // Gráfico de líneas (duración promedio)
  const lineCtx = document.getElementById("line-chart").getContext("2d");
  new Chart(lineCtx, {
    type: "line",
    data: {
      labels: [...new Set(events.map(e => e.Fecha))],
      datasets: [{
        label: "Duración Promedio (minutos)",
        data: [...new Set(events.map(e => e.Fecha))].map(date => {
          const cuts = events.filter(e => e.Fecha === date && e.Evento === "Se cortó");
          const durations = cuts.map(cut => {
            const back = events.find(e => e.Fecha === date && e.Evento === "Volvió" && new Date(e.Hora) > new Date(cut.Hora));
            if (back) {
              const start = new Date(`${date}T${cut.Hora}`);
              const end = new Date(`${date}T${back.Hora}`);
              return (end - start) / (1000 * 60);
            }
            return 0;
          });
          return durations.reduce((a, b) => a + b, 0) / durations.length || 0;
        }),
        borderColor: "#2196F3",
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });

  // Gráfico de pastel (cortes por hora)
  const pieCtx = document.getElementById("pie-chart").getContext("2d");
  new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: [...new Set(events.map(e => e.Hora.split(":")[0] + ":00"))],
      datasets: [{
        data: [...new Set(events.map(e => e.Hora.split(":")[0] + ":00"))].map(hour =>
          events.filter(e => e.Hora.startsWith(hour)).length
        ),
        backgroundColor: [
          "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40",
        ],
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

// Función para registrar un evento
function registerEvent(eventData) {
  const loadingMessage = document.getElementById("loading-message");
  loadingMessage.textContent = "Registrando evento...";

  // Simulamos el registro en Google Sheets
  events.push(eventData);
  loadingMessage.textContent = "Evento registrado. Recargando tabla...";

  setTimeout(() => {
    loadTable();
    initCharts();
    loadingMessage.textContent = "Tabla actualizada.";
  }, 1000);
}

// Event listeners para botones
document.getElementById("cut-button").addEventListener("click", () => {
  const now = new Date();
  const eventData = {
    Fecha: now.toISOString().split("T")[0],
    Hora: now.toTimeString().split(" ")[0].substring(0, 5),
    Evento: "Se cortó"
  };
  registerEvent(eventData);
});

document.getElementById("back-button").addEventListener("click", () => {
  const now = new Date();
  const eventData = {
    Fecha: now.toISOString().split("T")[0],
    Hora: now.toTimeString().split(" ")[0].substring(0, 5),
    Evento: "Volvió"
  };
  registerEvent(eventData);
});

// Lógica para agregar cortes manuales
document.getElementById("add-manual").addEventListener("click", () => {
  const dateInput = document.getElementById("manual-date").value;
  const type = document.getElementById("manual-type").value;
  if (dateInput) {
    const date = new Date(dateInput);
    const eventData = {
      Fecha: date.toISOString().split("T")[0],
      Hora: date.toTimeString().split(" ")[0].substring(0, 5),
      Evento: type
    };
    registerEvent(eventData);
  }
});

// Cargar datos al iniciar
loadCSV();
