// URL de la aplicación web de Google Apps Script
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyTlFDXpXsWzwgCzZ98Xu95m7Sapqn3-dKjkhcFbAIIasBGeodU0cfi930ZK9On5wh37Q/exec";

// URL del CSV de Google Sheets (para lectura)
const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR-QYY0OvN7AVVK0UhEEveCHNjeeIueMIdWCY6HwObRuo3m5nuCeRWHxfNcHsuDZVdjeNL2uYH_PzFM/pub?output=csv";

// Variables globales para almacenar los eventos y los gráficos
let events = [];
let barChart, lineChart, pieChart;

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
  updateLostHoursCard(events);
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

// Función para cargar la tabla (mostrar los últimos 10 eventos en pantalla, el resto con scroll)
function loadTable() {
  const tableBody = document.getElementById("events-body");
  tableBody.innerHTML = "";
  const sortedEvents = [...events].reverse(); // Ordenar los eventos de más reciente a más antiguo
  sortedEvents.forEach(event => {
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

// Función para convertir fecha de DD/MM/YYYY a YYYY-MM-DD para cálculos
function formatDateForCalculation(dateString) {
  const parts = dateString.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString;
}

// Función para calcular duración entre "Se cortó" y "Volvió"
function calculateDuration(date, time, type) {
  if (type === "Volvió") {
    const formattedDate = formatDateForCalculation(date);
    const startEvents = events.filter(e =>
      formatDateForCalculation(e.Fecha) === formattedDate &&
      e.Evento === "Se cortó" &&
      new Date(`${formattedDate}T${e.Hora}`) < new Date(`${formattedDate}T${time}`)
    );
    if (startEvents.length > 0) {
      const lastStartEvent = startEvents[startEvents.length - 1];
      const startTime = new Date(`${formattedDate}T${lastStartEvent.Hora}`);
      const endTime = new Date(`${formattedDate}T${time}`);
      const diffMinutes = (endTime - startTime) / (1000 * 60);
      const hours = Math.floor(diffMinutes / 60);
      const minutes = Math.floor(diffMinutes % 60);
      return `${hours}h ${minutes}m`;
    }
  }
  return "-";
}

// Función para inicializar gráficos (usando todos los eventos)
function initCharts() {
  // Destruir gráficos existentes si existen
  if (barChart) barChart.destroy();
  if (lineChart) lineChart.destroy();
  if (pieChart) pieChart.destroy();

  // Gráfico de barras (frecuencia por fecha, usando todos los eventos)
  const barCtx = document.getElementById("bar-chart").getContext("2d");
  barChart = new Chart(barCtx, {
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

  // Gráfico de líneas (duración promedio por día, usando todos los eventos)
  const lineCtx = document.getElementById("line-chart").getContext("2d");
  lineChart = new Chart(lineCtx, {
    type: "line",
    data: {
      labels: [...new Set(events.map(e => e.Fecha))],
      datasets: [{
        label: "Duración Promedio (minutos)",
        data: [...new Set(events.map(e => e.Fecha))].map(date => {
          const formattedDate = formatDateForCalculation(date);
          const cuts = events.filter(e => formatDateForCalculation(e.Fecha) === formattedDate && e.Evento === "Se cortó");
          let totalDuration = 0;
          let count = 0;
          cuts.forEach(cut => {
            const back = events.find(e =>
              formatDateForCalculation(e.Fecha) === formattedDate &&
              e.Evento === "Volvió" &&
              new Date(`${formattedDate}T${e.Hora}`) > new Date(`${formattedDate}T${cut.Hora}`)
            );
            if (back) {
              const start = new Date(`${formattedDate}T${cut.Hora}`);
              const end = new Date(`${formattedDate}T${back.Hora}`);
              totalDuration += (end - start) / (1000 * 60);
              count++;
            }
          });
          return count > 0 ? totalDuration / count : 0;
        }),
        borderColor: "#2196F3",
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    },
  });

  // Gráfico de pastel (cortes por hora, usando todos los eventos)
  const pieCtx = document.getElementById("pie-chart").getContext("2d");
  pieChart = new Chart(pieCtx, {
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

// Función para registrar un evento en Google Sheets
async function registerEvent(eventData) {
  const loadingMessage = document.getElementById("loading-message");
  loadingMessage.textContent = "Registrando evento en Google Sheets...";

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    });

    // Agregar el evento localmente para mostrarlo inmediatamente
    events.push(eventData);
    loadTable();
    initCharts();
  updateLostHoursCard(events);
    loadingMessage.textContent = "Evento registrado correctamente.";
  } catch (error) {
    loadingMessage.textContent = "Error al registrar el evento: " + error.message;
  }
}

// Event listeners para botones
document.getElementById("cut-button").addEventListener("click", () => {
  const now = new Date();
  const eventData = {
    Fecha: now.toISOString().split("T")[0].split('-').reverse().join('/'), // Formato DD/MM/YYYY
    Hora: now.toTimeString().split(" ")[0].substring(0, 5),
    Evento: "Se cortó"
  };
  registerEvent(eventData);
});

document.getElementById("back-button").addEventListener("click", () => {
  const now = new Date();
  const eventData = {
    Fecha: now.toISOString().split("T")[0].split('-').reverse().join('/'), // Formato DD/MM/YYYY
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
      Fecha: date.toISOString().split("T")[0].split('-').reverse().join('/'), // Formato DD/MM/YYYY
      Hora: date.toTimeString().split(" ")[0].substring(0, 5),
      Evento: type
    };
    registerEvent(eventData);
  }
});

// Asegurarse de que el contenedor de la tabla tenga un alto fijo y scroll
document.addEventListener('DOMContentLoaded', function() {
  const tableContainer = document.querySelector('.table-container');
  tableContainer.style.maxHeight = '300px'; // Altura fija para mostrar 10 registros
  tableContainer.style.overflowY = 'auto'; // Scroll vertical
});

// Para graficos horas perdidas
function updateLostHoursCard(data) {
  let totalMinutes = 0;
  let count = 0;

  data.forEach(event => {
    if (event.Evento === 'Volvió') {
      const duration = calculateDuration(event.Fecha, event.Hora, event.Evento);
      if (duration) {
        const [hours, minutes] = duration.split(/[h m]/).filter(Boolean).map(Number);
        totalMinutes += hours * 60 + minutes;
        count++;
      }
    }
  });

  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const averageMinutes = totalMinutes / count;
  const averageHours = Math.floor(averageMinutes / 60);
  const averageMins = Math.floor(averageMinutes % 60);

  document.getElementById('total-duration').textContent = `${totalHours}h ${totalMins}m`;
  document.getElementById('average-duration').textContent = `Promedio: ${averageHours}h ${averageMins}m`;
}

// Cargar datos al iniciar
loadCSV();
