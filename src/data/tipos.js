import { Building2, Building, Home, Store, Trees, Car } from "lucide-react";

export const TIPOS_INMUEBLE = [
  { key: "Piso", icon: Building2 },
  { key: "Ático", icon: Building },
  { key: "Casa / Chalet", icon: Home },
  { key: "Local", icon: Store },
  { key: "Terreno", icon: Trees },
  { key: "Garaje", icon: Car },
];

/* Grupos usados por el esquema para decidir qué campos aplican a qué tipo. */
export const RESIDENCIAL = ["Piso", "Ático", "Casa / Chalet"];
export const EDIFICADO = [...RESIDENCIAL, "Local", "Garaje"];
export const CON_PARCELA = ["Casa / Chalet", "Terreno"];
export const EN_EDIFICIO = ["Piso", "Ático", "Local", "Garaje"];
