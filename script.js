// URL DEPLOYMENT BARU
const API_URL = "https://script.google.com/macros/s/AKfycbww8p0lReFHcGbS96z86iDUAMqJ8t1J_yi6XBfXAFQ3_mNRlFkYuPVm5c6MMiyy_ebxpw/exec"; 

let myChart;
let globalConfig = { high: 190, low: 185 };
let isEditing = false; // Mencegah input berubah saat ngetik

document.addEventListener('DOMContentLoaded', () => {
    initChart();
    fetchData();
    setInterval(fetchData, 3000); // Sync tiap 3 detik

    // Deteksi User mengetik agar tidak ditimpa auto-sync
    const iH = document.getElementById('inputHigh');
    const iL = document.getElementById('inputLow');
    iH.addEventListener('focus', () => isEditing=true); iH.addEventListener('blur', () => isEditing=false);
    iL.addEventListener('focus', () => isEditing=true); iL.addEventListener('blur', () => isEditing=false);
});

function initChart() {
    const ctx = document.getElementById('liveChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'MID', borderColor: '#facc15', borderWidth:3, data: [], tension:0.4 },
            { label: 'IN', borderColor: '#38bdf8', borderWidth:1, data: [], tension:0.4 },
            { label: 'OUT', borderColor: '#ef4444', borderWidth:1, data: [], tension:0.4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false, animation: false, scales:{x:{display:false}, y:{grid:{color:'#334155'}}} }
    });
}

async function fetchData() {
    try {
        const res = await fetch(API_URL + "?limit=50&nocache=" + Date.now());
        const json = await res.json();
        
        // 1. SYNC CONFIG (Agar HP A dan HP B sama)
        const cfg = json.config;
        globalConfig = cfg;
        
        // Update Kotak Input (Hanya jika tidak sedang diedit)
        if(!isEditing) {
            document.getElementById('inputHigh').value = cfg.high;
            document.getElementById('inputLow').value = cfg.low;
        }
        document.getElementById('configInfo').innerText = `Target Operasional: ${cfg.low} - ${cfg.high} °C`;

        // 2. UPDATE DATA
        if (json.data.length > 0) {
            const data = json.data;
            const latest = data[data.length-1];
            const valMid = Number(latest.m);
            
            // Update Angka Besar
            const tempEl = document.getElementById('mainTemp');
            tempEl.innerText = valMid.toFixed(1) + " °C";
            
            // Logika Warna Status (Ikut Config Terbaru)
            const statEl = document.getElementById('sysStatus');
            if (valMid > cfg.high) {
                statEl.innerHTML = "<span class='badge bg-alarm'>⚠️ OVERHEAT</span>";
                tempEl.style.color = "#ef4444";
            } else if (valMid < cfg.low) {
                statEl.innerHTML = "<span class='badge bg-alarm'>⚠️ LOW TEMP</span>";
                tempEl.style.color = "#facc15";
            } else {
                statEl.innerHTML = "<span class='badge bg-ok'>✅ NORMAL</span>";
                tempEl.style.color = "#4ade80";
            }

            // Update Chart
            myChart.data.labels = data.map(d => new Date(d.t).toLocaleTimeString('id-ID'));
            myChart.data.datasets[0].data = data.map(d => d.m);
            myChart.data.datasets[1].data = data.map(d => d.i);
            myChart.data.datasets[2].data = data.map(d => d.o);
            myChart.update();
        }
    } catch(e) { console.error(e); }
}

async function saveConfig() {
    const h = document.getElementById('inputHigh').value;
    const l = document.getElementById('inputLow').value;
    Swal.fire({title:'Menyimpan...', didOpen:()=>Swal.showLoading()});
    
    try {
        await fetch(API_URL, { method:'POST', body:JSON.stringify({action:"updateConfig", high:h, low:l}) });
        Swal.fire('Berhasil', 'Setting Tersimpan & Tersinkron!', 'success');
        isEditing = false; // Lepas lock editing
    } catch(e) { Swal.fire('Error', 'Gagal koneksi', 'error'); }
}

async function downloadPDF(hours) {
    Swal.fire({title:'Generate PDF...', didOpen:()=>Swal.showLoading()});
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p','mm','a4');
    
    const res = await fetch(API_URL + "?limit=2000");
    const json = await res.json();
    const data = json.data; 
    
    const now = new Date();
    const cutoff = new Date(now.getTime() - (hours*3600000));
    const filtered = data.filter(d => new Date(d.t) >= cutoff);

    // Header Resmi Indofood
    doc.setFontSize(14); doc.setFont("helvetica","bold");
    doc.text("PT INDOFOOD CBP SUKSES MAKMUR Tbk", 14, 15);
    doc.setFontSize(10); doc.setFont("helvetica","normal");
    doc.text("DIVISI NOODLE - PABRIK CIBITUNG", 14, 20);
    
    doc.setFontSize(16); doc.setFont("helvetica","bold");
    doc.text("LAPORAN MONITORING SUHU FRYER", 105, 30, {align:"center"});
    doc.line(14, 33, 196, 33);

    // Meta Data
    doc.setFontSize(9); doc.setFont("helvetica","normal");
    doc.text(`Tanggal: ${now.toLocaleDateString('id-ID')}`, 14, 40);
    doc.text(`Mesin: PETIR-01`, 14, 45);
    doc.text(`Standar: ${globalConfig.low}-${globalConfig.high} °C`, 120, 40);

    // Tabel
    const body = filtered.map(d => {
        let st = "OK";
        if(d.m > globalConfig.high) st="OVER"; else if(d.m < globalConfig.low) st="LOW";
        return [
            new Date(d.t).toLocaleTimeString('id-ID'),
            Number(d.i).toFixed(1), Number(d.m).toFixed(1), Number(d.o).toFixed(1),
            st, ""
        ];
    });

    doc.autoTable({
        startY: 50,
        head: [['JAM','IN','MID','OUT','STATUS','PARAF']],
        body: body,
        theme: 'grid',
        headStyles: {fillColor:[255,255,255], textColor:[0,0,0], lineColor:[0,0,0], lineWidth:0.1},
        styles: {lineColor:[0,0,0], lineWidth:0.1, textColor:[0,0,0], halign:'center'},
        didParseCell: function(data) {
            if(data.section==='body' && data.column.index===4 && data.cell.raw!=="OK") {
                data.cell.styles.textColor = [255,0,0]; data.cell.styles.fontStyle='bold';
            }
        }
    });

    // Tanda Tangan
    let y = doc.lastAutoTable.finalY + 15;
    if(y>250){doc.addPage(); y=20;}
    
    const signs = [
        {t:"Dibuat Oleh", r:"Operator Fryer", x:30},
        {t:"Diperiksa Oleh", r:"Section Produksi", x:105},
        {t:"Disetujui Oleh", r:"Supervisor QC", x:180}
    ];
    signs.forEach(s => {
        doc.text(s.t, s.x, y, {align:"center"});
        doc.text("(....................)", s.x, y+20, {align:"center"});
        doc.setFont("helvetica","bold"); doc.text(s.r, s.x, y+25, {align:"center"});
        doc.setFont("helvetica","normal");
    });

    doc.save(`Laporan_QC_${now.getTime()}.pdf`);
    Swal.fire('Selesai', 'PDF Terunduh', 'success');
}
