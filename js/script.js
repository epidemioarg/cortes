// URL de la hoja de Google Sheets publicada
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSDKmW7_uOnsVm_DE8z5fUPTp1dySD1bnuK-Gh2-RKjN2Fj9zd-99CwgkQ4kuJlzX-n-g7WRnGcApbd/pubhtml?gid=0&single=true';

// Array local para sincronización temporal
let localData = [];

function logEvent(eventType) {
    const now = new Date();
    const date = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('-');
    const time = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const newEntry = { date, time, event: eventType };

    localData.unshift(newEntry);
    if (localData.length > 10) localData.pop();
    updateTable();

    const formUrl = `https://docs.google.com/forms/d/e/1FAIpQLSf.../viewform?entry.123456789=date=${date}&entry.987654321=time=${time}&entry.456789123=event=${encodeURIComponent(eventType)}`;
    window.open(formUrl, '_blank');
}

function loadTable() {
    console.log('Intentando cargar datos desde:', sheetUrl);
    fetch(sheetUrl)
        .then(response => {
            console.log('Respuesta recibida, estado:', response.status);
            if (!response.ok) throw new Error('Error en la respuesta: ' + response.status);
            return response.text();
        })
        .then(html => {
            console.log('Contenido HTML recibido:', html.substring(0, 200) + '...');
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const table = doc.querySelector('table');
            if (table) {
                const rows = table.querySelectorAll('tbody tr');
                const sheetData = [];
                rows.forEach(row => {
                    const cols = row.querySelectorAll('td');
                    if (cols.length >= 3) {
                        sheetData.push({
                            date: cols[0].textContent.trim(),
                            time: cols[1].textContent.trim(),
                            event: cols[2].textContent.trim()
                        });
                    }
                });

                localData = sheetData.slice(-10).sort((a, b) => {
                    const dateA = new Date(a.date.split('-').reverse().join('-') + ' ' + a.time);
                    const dateB = new Date(b.date.split('-').reverse().join('-') + ' ' + b.time);
                    return dateA - dateB;
                });
                updateTable();
                generateCharts(sheetData);
            } else {
                console.warn('No se encontró tabla en la hoja publicada. Verifica la publicación o el gid.');
            }
        })
        .catch(error => console.error('Error al cargar la tabla:', error));
}

function updateTable() {
    const tbody = document.getElementById('log-body');
    tbody.innerHTML = '';
    localData.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${log.date}</td><td>${log.time}</td><td>${log.event}</td>`;
        tbody.appendChild(row);
    });
}

function showPreviousCutForm() {
    console.log('Mostrando formulario');
    document.getElementById('previous-cut-form').style.display = 'block';
}

function hidePreviousCutForm() {
    document.getElementById('previous-cut-form').style.display = 'none';
}

function submitPreviousCut(event) {
    event.preventDefault();
    const date = document.getElementById('prev-date').value.split('-').reverse().join('-');
    const time = document.getElementById('prev-time').value;
    const eventType = document.getElementById('prev-event').value;
    const newEntry = { date, time, event: eventType };

    localData.unshift(newEntry);
    if (localData.length > 10) localData.pop();
    updateTable();

    const formUrl = `https://docs.google.com/forms/d/e/1FAIpQLSf.../viewform?entry.123456789=date=${newEntry.date}&entry.987654321=time=${newEntry.time}&entry.456789123=event=${encodeURIComponent(newEntry.event)}`;
    window.open(formUrl, '_blank');

    hidePreviousCutForm();
    document.getElementById('previous-cut-form-content').reset();
}

function generateCharts(data) {
    const ctxBar = document.getElementById('barChart').getContext('2d');
    const ctxLine = document.getElementById('lineChart').getContext('2d');
    const ctxPie = document.getElementById('pieChart').getContext('2d');

    if (window.barChartInstance) window.barChartInstance.destroy();
    if (window.lineChartInstance) window.lineChartInstance.destroy();
    if (window.pieChartInstance) window.pieChartInstance.destroy();

    const frequency = {};
    data.filter(item => item.event === 'Se cortó').forEach(item => {
        frequency[item.date] = (frequency[item.date] || 0) + 1;
    });
    const freqDates = Object.keys(frequency);
    const freqCounts = freqDates.map(date => frequency[date]);
    window.barChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: { labels: freqDates, datasets: [{ label: 'Frecuencia de cortes', data: freqCounts, backgroundColor: ['#ef4444', '#f97316', '#fbbf24', '#34d399', '#3b82f6'], borderColor: ['#dc2626', '#f97316', '#fbbf24', '#34d399', '#3b82f6'], borderWidth: 1 }] },
        options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Número de cortes' } }, x: { title: { display: true, text: 'Fecha' } } } }
    });

    const durations = {};
    let lastCutTime = null, lastCutDate = null;
    data.forEach(item => {
        if (item.event === 'Se cortó') { lastCutTime = item.time; lastCutDate = item.date; }
        else if (item.event === 'Volvió' && lastCutDate && lastCutTime) {
            const durationMs = new Date(`${lastCutDate} ${item.time}`) - new Date(`${lastCutDate} ${lastCutTime}`);
            const durationMin = durationMs / (1000 * 60);
            if (durationMin >= 0) durations[lastCutDate] = (durations[lastCutDate] || []).concat(durationMin);
            lastCutTime = null; lastCutDate = null;
        }
    });
    const avgDurations = {};
    for (let date in durations) avgDurations[date] = durations[date].reduce((a, b) => a + b, 0) / durations[date].length || 0;
    const durDates = Object.keys(avgDurations);
    const durValues = durDates.map(date => avgDurations[date]);
    window.lineChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: { labels: durDates, datasets: [{ label: 'Duración promedio (min)', data: durValues, fill: false, borderColor: '#3b82f6', tension: 0.1 }] },
        options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Minutos' } }, x: { title: { display: true, text: 'Fecha' } } } }
    });

    const hourly = {};
    data.filter(item => item.event === 'Se cortó').forEach(item => {
        const hour = item.time.split(':')[0];
        hourly[hour] = (hourly[hour] || 0) + 1;
    });
    const hourLabels = Object.keys(hourly);
    const hourCounts = hourLabels.map(hour => hourly[hour]);
    window.pieChartInstance = new Chart(ctxPie, {
        type: 'pie',
        data: { labels: hourLabels, datasets: [{ data: hourCounts, backgroundColor: ['#ef4444', '#f97316', '#fbbf24', '#34d399', '#3b82f6', '#9333ea'] }] },
        options: { plugins: { legend: { position: 'bottom' } } }
    });
}

document.getElementById('se-corto').addEventListener('click', () => logEvent('Se cortó'));
document.getElementById('volvio').addEventListener('click', () => logEvent('Volvió'));
document.getElementById('add-previous-cut').addEventListener('click', showPreviousCutForm);
document.getElementById('cancel-form').addEventListener('click', hidePreviousCutForm);
document.getElementById('previous-cut-form-content').addEventListener('submit', submitPreviousCut);

window.onload = loadTable;