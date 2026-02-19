import { useState, useEffect } from "react";
import jsPDF from "jspdf";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { db } from "./firebase";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

export default function App() {
  const [busca, setBusca] = useState("");
  const [imoveis, setImoveis] = useState([]);
  const [usuario, setUsuario] = useState(localStorage.getItem("m2_usuario") || "");
  const [modo, setModo] = useState("visitante");

  const [form, setForm] = useState({
    condominio: "",
    bairro: "",
    area: "",
    preco: "",
    data: new Date().toISOString().slice(0,10),
    fonte: "Profissional"
  });

  useEffect(() => {
  async function carregar(){
    const snapshot = await getDocs(collection(db, "imoveis"));
    const lista = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setImoveis(lista);
  }
  carregar();
}, []);

  function calcularM2(area, preco) {
    if (!area || !preco) return "";
    return (preco / area).toFixed(2);
  }

async function adicionar() {
  if(!usuario) return alert("Informe seu nome");

  const m2 = calcularM2(Number(form.area), Number(form.preco));

  const registro = {
    condominio: form.condominio,
    bairro: form.bairro,
    area: form.area,
    preco: form.preco,
    data: new Date().toISOString().slice(0,10),
    fonte: "Profissional",
    responsavel: usuario,
    m2,
    favorito:false
  };

  try{
    const docRef = await addDoc(collection(db, "imoveis"), registro);
    setImoveis(prev => [...prev, { id: docRef.id, ...registro }]);

    setForm({
      condominio: "",
      bairro: "",
      area: "",
      preco: "",
      data: new Date().toISOString().slice(0,10),
      fonte: "Profissional"
    });

  }catch(e){
    console.error(e);
    alert("Erro ao salvar no banco");
  }
}

  async function remover(id){
  await deleteDoc(doc(db, "imoveis", id));
  setImoveis(imoveis.filter(i => i.id !== id));
}

  function mediaCondominio(nome){
    const lista = imoveis.filter(i=>i.condominio===nome).map(i=>Number(i.m2));
    if(!lista.length) return null;
    return lista.reduce((a,b)=>a+b,0)/lista.length;
  }

function gerarPDF(imovel){
  const doc = new jsPDF();

  // CABEÇALHO
  doc.setFillColor(11,31,59);
  doc.rect(0,0,210,30,"F");

  doc.setTextColor(255,255,255);
  doc.setFontSize(18);
  doc.text("m²",20,18);

  doc.setFontSize(11);
  doc.text("índice imobiliário local",40,18);

  doc.setTextColor(0,0,0);

  // DADOS DO CONDOMÍNIO
  const lista = imoveis
    .filter(i => i.condominio === imovel.condominio && i.m2)
    .sort((a,b)=> new Date(a.data)-new Date(b.data))
    .map(i => Number(i.m2));

  let media = null;
  if(lista.length){
    media = lista.reduce((a,b)=>a+b,0)/lista.length;
  }

  let diferenca = null;
  if(media){
    diferenca = ((imovel.m2 - media)/media)*100;
  }

  // TEXTO
  doc.setFontSize(12);
  doc.text(`Condomínio: ${imovel.condominio}`,20,50);
  doc.text(`Bairro: ${imovel.bairro}`,20,60);
  doc.text(`Área: ${imovel.area} m²`,20,70);
  doc.text(`Preço: R$ ${imovel.preco}`,20,80);
  doc.text(`Valor por m²: R$ ${imovel.m2}`,20,90);

  if(diferenca !== null){
    doc.text(`Diferença para o mercado: ${diferenca.toFixed(1)}%`,20,100);
  }

  if(media){
    doc.text(`Média do condomínio: R$ ${media.toFixed(2)}/m²`,20,110);
  }

  // DIAGNÓSTICO
  doc.setFontSize(14);

  if(diferenca !== null){
    if(diferenca > 10){
      doc.setTextColor(214,69,69);
      doc.text("Acima do mercado",20,130);
    } 
    else if(diferenca < -10){
      doc.setTextColor(45,127,249);
      doc.text("Oportunidade de compra",20,130);
    }
    else{
      doc.setTextColor(31,169,113);
      doc.text("Dentro do mercado",20,130);
    }
  }

  let conclusao = "";

if(diferenca !== null){
  if(diferenca > 10){
    conclusao = "O imóvel está acima do valor de mercado. Existe grande chance de baixa procura até ajuste de preço.";
  }
  else if(diferenca < -10){
    conclusao = "O imóvel apresenta oportunidade de compra em relação ao mercado atual.";
  }
  else{
    conclusao = "O imóvel está posicionado dentro do valor de mercado, com boa liquidez esperada.";
  }
}

doc.setFontSize(11);
doc.text("Conclusão:",20,150);
doc.text(doc.splitTextToSize(conclusao,170),20,160);

  doc.setTextColor(0,0,0);

  // GRÁFICO DESENHADO
  if(lista.length>1){

    const xStart=20;
    const yBase=230;
    const largura=170;
    const altura=40;

    const min=Math.min(...lista);
    const max=Math.max(...lista);
    const passoX=largura/(lista.length-1);

    doc.setFontSize(12);
    doc.text("Histórico de valorização",20,170);

    for(let i=0;i<lista.length-1;i++){
      const y1=yBase-((lista[i]-min)/(max-min))*altura;
      const y2=yBase-((lista[i+1]-min)/(max-min))*altura;

      doc.line(
        xStart+i*passoX,
        y1,
        xStart+(i+1)*passoX,
        y2
      );
    }
  }

  doc.setFontSize(10);
  doc.text("m² — o mercado não opina, ele revela",20,255);

  const hoje = new Date().toLocaleDateString("pt-BR");

doc.setFontSize(9);
doc.text(`Emitido em: ${hoje}`,20,265);
doc.text(`Responsável: ${usuario}`,20,272);
doc.text("Documento gerado pelo sistema m² — índice imobiliário local",20,279);

  doc.save("RELATÓRIOm2.pdf");
}

  function exportarBase(){
  const dados = JSON.stringify(imoveis, null, 2);
  const blob = new Blob([dados], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "ÚltimoBackupM2.json";
  a.click();

  URL.revokeObjectURL(url);
}

function diagnostico(imovel){
  const lista = imoveis
    .filter(i => i.condominio === imovel.condominio && i.m2)
    .map(i => Number(i.m2));

  if(lista.length < 2) return {texto:"Dados insuficientes", cor:"#6B778C"};

  const media = lista.reduce((a,b)=>a+b,0)/lista.length;
  const diff = (imovel.m2 - media)/media;

  if(diff > 0.1) return {texto:"Acima do mercado", cor:"#D64545"};
  if(diff < -0.1) return {texto:"Oportunidade", cor:"#2D7FF9"};
  return {texto:"Dentro do mercado", cor:"#1FA971"};
}

  function tendenciaCondominio(nome){
  const lista = imoveis
    .filter(i => i.condominio === nome && i.m2 && i.data)
    .sort((a,b)=> new Date(a.data)-new Date(b.data));

  if(lista.length < 4) return null;

  const metade = Math.floor(lista.length/2);

  const antigos = lista.slice(0,metade);
  const recentes = lista.slice(metade);

  const mediaAntiga = antigos.reduce((a,b)=>a+Number(b.m2),0)/antigos.length;
  const mediaNova = recentes.reduce((a,b)=>a+Number(b.m2),0)/recentes.length;

  const variacao = ((mediaNova-mediaAntiga)/mediaAntiga)*100;

  return variacao;
}

function rankingCondominios(){
  const grupos = {};

  imoveis.forEach(i=>{
    if(!i.condominio || !i.m2) return;

    if(!grupos[i.condominio]) grupos[i.condominio]=[];
    grupos[i.condominio].push(Number(i.m2));
  });

  return Object.entries(grupos)
    .map(([nome,valores])=>{
      const media = valores.reduce((a,b)=>a+b,0)/valores.length;
      return {nome,media,qtd:valores.length};
    })
    .sort((a,b)=>b.media-a.media);
}



function importarBase(event){
  const file = event.target.files[0];
  if(!file) return;

  const reader = new FileReader();

  reader.onload = function(e){
    try{
      const dados = JSON.parse(e.target.result);
      setImoveis(dados);
      alert("Base restaurada com sucesso!");
    }catch{
      alert("Arquivo inválido");
    }
  };

  reader.readAsText(file);
}

function resumoBusca(){
  if(!busca) return null;

  const lista = imoveis.filter(i =>
    i.condominio.toLowerCase().includes(busca.toLowerCase())
  );

  if(lista.length === 0) return null;

  const media = lista.reduce((a,b)=>a+Number(b.m2),0)/lista.length;

  return {
    nome: lista[0].condominio,
    media,
    qtd: lista.length,
    tendencia: tendenciaCondominio(lista[0].condominio)
  };
}

function toggleFavorito(id){
  setImoveis(imoveis.map(i =>
    i.id === id ? {...i, favorito: !i.favorito} : i
  ));
}

function oportunidades(){
  return imoveis.filter(i=>{
    const lista = imoveis
      .filter(x=>x.condominio===i.condominio && x.m2)
      .map(x=>Number(x.m2));

    if(lista.length<2) return false;

    const media = lista.reduce((a,b)=>a+b,0)/lista.length;
    return i.m2 < media*0.9;
  });
}

function dadosGrafico(){
  if(!busca) return [];

  const lista = imoveis
    .filter(i=>i.condominio.toLowerCase().includes(busca.toLowerCase()))
    .sort((a,b)=> new Date(a.data)-new Date(b.data));

  return lista.map(i=>({
    data:i.data,
    m2:Number(i.m2)
  }));
}

function classeMercado(imovel){
  const lista = imoveis
    .filter(i => i.condominio === imovel.condominio && i.m2)
    .map(i => Number(i.m2));

  if(lista.length < 2) return "";

  const media = lista.reduce((a,b)=>a+b,0)/lista.length;
  const diff = (imovel.m2 - media)/media;

  if(diff > 0.1) return "alto";
  if(diff < -0.1) return "baixo";
  return "ok";
}

function resumoGeral(){
  if(imoveis.length===0) return null;

  const valores = imoveis.map(i=>Number(i.m2)).filter(Boolean);

  const media = valores.reduce((a,b)=>a+b,0)/valores.length;

  const ultimo = imoveis
    .slice()
    .sort((a,b)=> new Date(b.data)-new Date(a.data))[0];

  return {
    media,
    qtd: imoveis.length,
    ultimo: ultimo?.data
  };
}

  return (
    <div className="container">
      <div className="header">
        {resumoGeral() && (
  <div className="card resumo" style={{marginTop:0}}>
    <b>Média geral:</b> R$ {resumoGeral().media.toFixed(0)}/m²<br/>
    <b>Registros:</b> {resumoGeral().qtd}<br/>
    <b>Atualizado:</b> {resumoGeral().ultimo}
  </div>
)}
        m²
        <div className="sub">índice imobiliário local</div>
      </div>

      <div style={{marginTop:"15px"}}>
  <button onClick={()=>setModo("visitante")}>Modo Visitante</button>
  <button onClick={()=>setModo("admin")} style={{marginLeft:"10px"}}>
    Modo Admin
  </button>
</div>

{modo === "admin" && (
<>
  
  <h2 style={{marginTop:"20px"}}>Novo registro</h2>

      <input placeholder="Seu nome"
        value={usuario}
        onChange={e=>setUsuario(e.target.value)} />
  
</>
)}
      

      <br/><br/>

      <input placeholder="Condomínio"
        value={form.condominio}
        onChange={e=>setForm({...form, condominio:e.target.value})} />

      <input placeholder="Bairro"
        value={form.bairro}
        onChange={e=>setForm({...form, bairro:e.target.value})} />

      <input type="number" placeholder="Área m²"
        value={form.area}
        onChange={e=>setForm({...form, area:e.target.value})} />

      <input type="number" placeholder="Preço"
        value={form.preco}
        onChange={e=>setForm({...form, preco:e.target.value})} />

      <button className="btn" onClick={adicionar}>Salvar</button>
      <input type="file" onChange={importarBase} />

      <hr/>

      <h2 style={{marginTop:"30px"}}>Analisar mercado</h2>

      <input
      placeholder="Buscar condomínio ou bairro..."
      value={busca}
      onChange={e=>setBusca(e.target.value)}
      style={{marginTop:"20px", padding:"8px", width:"100%"}}
      />

      {resumoBusca() && (
  <div className="card" style={{background:"#0B1F3B", color:"white"}}>
    <h2>{resumoBusca().nome}</h2>
    Média: R$ {resumoBusca().media.toFixed(0)}/m²<br/>
    Registros: {resumoBusca().qtd}<br/>

    {resumoBusca().tendencia !== null && (
      <>Tendência: {resumoBusca().tendencia.toFixed(1)}%</>
    )}</div>

    
  
)}

{dadosGrafico().length>1 && (
  <div className="card">
    <h3>Valorização</h3>
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={dadosGrafico()}>
        <XAxis dataKey="data"/>
        <YAxis/>
        <Tooltip/>
        <Line type="monotone" dataKey="m2" stroke="#1F4E79" strokeWidth={3}/>
      </LineChart>
    </ResponsiveContainer>
  </div>
)}

      {imoveis
  .filter(i =>
    i.condominio.toLowerCase().includes(busca.toLowerCase()) ||
    i.bairro.toLowerCase().includes(busca.toLowerCase())
  )
  .map(i=>(
        <div key={i.id} className={`card ${classeMercado(i)}`}>
          <b>{i.condominio}</b> - {i.bairro} <br/>
          
          <div><b>m²:</b> R$ {i.m2}</div>
          {tendenciaCondominio(i.condominio) !== null && (
  <div style={{fontWeight:"bold"}}>
    Tendência: {tendenciaCondominio(i.condominio).toFixed(1)}%
  </div>
)}

          <div style={{color: diagnostico(i).cor, fontWeight:"bold"}}>
            {diagnostico(i).texto}
          </div>
          <br/>
          {modo === "admin" && (
<>
  <button onClick={()=>gerarPDF(i)}>PDF</button>
  <button onClick={()=>remover(i.id)}>Excluir</button>
  <button onClick={()=>toggleFavorito(i.id)}>
    {i.favorito ? "★ Favorito" : "☆ Favoritar"}
  </button>
</>
)}
          <button onClick={adicionar}>Salvar</button>
          <button className="btn" onClick={exportarBase}>Backup</button>
        </div>
      ))}

      <h2 style={{marginTop:"30px"}}>Ranking de m²</h2>

{rankingCondominios().map((r,idx)=>(
  <div key={idx} className="card">
    <b>{idx+1}º {r.nome}</b><br/>
    Média: R$ {r.media.toFixed(0)}/m²<br/>
    Registros: {r.qtd}
  </div>
))}

<h2 style={{marginTop:"30px"}}>Oportunidades</h2>

{oportunidades().length===0 && <div>Nenhuma ainda</div>}

{oportunidades().map((i)=>(
  <div key={i.id} className="card" style={{border:"2px solid #2D7FF9"}}>
    <b>{i.condominio}</b> - {i.bairro}<br/>
    m²: R$ {i.m2}
  </div>
))}

    </div>
  );
}