/* Nombres de los campos de IA Gestión como los entiende la oficina. */
export const ETIQUETAS_IAGESTION = {
  Direccion: "Dirección", Numero: "Número", Planta: "Planta", Puerta: "Puerta", CP: "Código postal", Provincia: "Provincia",
  Poblacion: "Población", Municipio: "Municipio", RC: "Referencia catastral", Tipo: "Tipo de inmueble",
  es_atico: "Ático", es_duplex: "Dúplex", Precio: "Precio", IBI: "IBI (€/año)", Gastos_Comunidad: "Comunidad (€/mes)",
  Exclusiva: "Exclusiva", Certificado_Energetico: "Certificado energético", Metros_Construidos: "M² construidos",
  Metros_Utiles: "M² útiles", Metros_Parcela: "M² de parcela", Metros_Terraza: "M² de terraza", Metros_Salon: "M² del salón",
  Metros_Fachada: "Metros de fachada", Antiguedad: "Año de construcción", Dormitorios: "Dormitorios", Banos: "Baños", Aseos: "Aseos",
  Ascensor: "Ascensor", Terraza: "Terraza", Trastero: "Trastero", Garajes: "Garajes", Piscina: "Piscina", Jardin: "Jardín",
  CheckVentanasAluminio: "Ventanas de aluminio", CheckVentanasPVC: "Ventanas de PVC", CheckVentanasMadera: "Ventanas de madera",
  CheckVentanasClimalit: "Ventanas Climalit", CheckSueloTarima: "Suelo de tarima", CheckSueloParquet: "Suelo de parquet",
  CheckSueloCeramicaGress: "Suelo cerámico/gres", Calefaccion: "Calefacción", Estado_General: "Estado de conservación",
  CheckVistasMar: "Vistas al mar", CheckVistasDestacadas: "Vistas despejadas", Observaciones_Publicas: "Descripción pública",
};
export const etiquetaIagestion = (k) => ETIQUETAS_IAGESTION[k] || k;

/* 1/0 y "si" se leen mejor como Sí. */
export const valorIagestion = (v) => (v === 1 || v === "si" ? "Sí" : v === 0 || v === "no" ? "No" : String(v));
