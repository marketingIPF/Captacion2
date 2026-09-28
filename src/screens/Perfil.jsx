import { useState } from "react";
import { RefreshCw, LogOut, ShieldCheck, Trash2, Users } from "lucide-react";
import { Avatar } from "../components/Avatar.jsx";
import { BotonNotificaciones } from "../components/BotonNotificaciones.jsx";
import { MAX_HISTORIAL } from "../lib/storage.js";

export function Perfil({ agente, sent, drafts, enCola = 0, pin, onChangeAgent, onRefreshAgentes, onCerrarSesion, onBorrarTodo }) {
  const [confirmar, setConfirmar] = useState(false);
  const mias = sent.filter((f) => f.agenteId === agente.id);

  return (
    <div className="min-h-screen bg-ios-fondo pb-[calc(env(safe-area-inset-bottom)+96px)]">
      <header className="px-6 pt-14">
        <h1 className="text-[30px] font-extrabold text-ios-texto">Perfil</h1>
      </header>

      <div className="px-5 mt-4 space-y-4">
        <div className="neu rounded-3xl p-6 flex flex-col items-center text-center">
          <Avatar agente={agente} tam={88} className="ring-2 ring-rk-softBorde" />
          <div className="text-[20px] font-bold mt-3 text-ios-texto">{agente.name}</div>
          <div className="text-ios-texto2 text-[14px]">{agente.role}</div>
          {agente.email && <div className="text-[13px] mt-1 text-rk-naranja break-all">{agente.email}</div>}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="neu rounded-2xl p-4 text-center">
            <div className="text-[26px] font-extrabold text-rk-naranja leading-none">{mias.length}</div>
            <div className="text-[11.5px] text-ios-texto2 mt-1 leading-tight">Enviadas por ti</div>
          </div>
          <div className="neu rounded-2xl p-4 text-center">
            <div className="text-[26px] font-extrabold text-ios-texto leading-none">{drafts.length}</div>
            <div className="text-[11.5px] text-ios-texto2 mt-1 leading-tight">Borradores</div>
          </div>
          <div className={`rounded-2xl p-4 text-center ${enCola > 0 ? "bg-amber-50 border border-amber-200" : "neu"}`}>
            <div className={`text-[26px] font-extrabold leading-none ${enCola > 0 ? "text-amber-600" : "text-ios-texto"}`}>{enCola}</div>
            <div className="text-[11.5px] text-ios-texto2 mt-1 leading-tight">Sin enviar</div>
          </div>
        </div>

        <div className="neu rounded-2xl divide-y divide-ios-borde overflow-hidden">
          <BotonNotificaciones
            credenciales={{ pin, agenteId: agente.id }}
            descripcion="Te avisamos cuando la oficina mueva una captación tuya."
          />
          <button
            type="button"
            onClick={onChangeAgent}
            className="w-full flex items-center gap-3 px-5 py-4 active:bg-ios-fondo transition text-left"
          >
            <Users size={17} className="text-ios-texto2 shrink-0" aria-hidden="true" />
            <span className="flex-1 font-semibold text-gray-800 text-[14.5px]">Cambiar de agente</span>
          </button>
          <button
            type="button"
            onClick={onRefreshAgentes}
            className="w-full flex items-center gap-3 px-5 py-4 active:bg-ios-fondo transition text-left"
          >
            <RefreshCw size={17} className="text-ios-texto2 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <div className="font-semibold text-gray-800 text-[14.5px]">Actualizar lista de agentes</div>
              <div className="text-[12px] text-ios-texto2">Cuando entra o sale alguien del equipo</div>
            </div>
          </button>
          <button
            type="button"
            onClick={onCerrarSesion}
            className="w-full flex items-center gap-3 px-5 py-4 active:bg-ios-fondo transition text-left"
          >
            <LogOut size={17} className="text-ios-texto2 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <div className="font-semibold text-gray-800 text-[14.5px]">Cerrar sesión en este dispositivo</div>
              <div className="text-[12px] text-ios-texto2">Vuelve a pedir el PIN. Las fichas se conservan.</div>
            </div>
          </button>
        </div>

        <div className="neu rounded-2xl p-5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-rk-naranja shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-[12.5px] text-ios-texto2 leading-relaxed">
              <p className="font-semibold text-gray-800 mb-1">Datos personales</p>
              <p>
                Las fichas contienen nombre, teléfono y DNI de los propietarios. Se guardan
                solo en este dispositivo (últimas {MAX_HISTORIAL}) y se envían a la oficina.
                Bórralas cuando ya no las necesites y bloquea el móvil con contraseña.
              </p>
            </div>
          </div>

          {!confirmar ? (
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-600 font-semibold text-[13.5px] active:scale-95 transition"
            >
              <Trash2 size={16} aria-hidden="true" /> Borrar todos los datos del dispositivo
            </button>
          ) : (
            <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3">
              <p className="text-[12.5px] text-red-800 mb-2">
                Se borrarán los borradores y el historial de este móvil. No se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { onBorrarTodo(); setConfirmar(false); }}
                  className="flex-1 py-2 rounded-xl bg-red-600 text-white text-[13px] font-bold active:scale-95 transition"
                >
                  Sí, borrar todo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmar(false)}
                  className="flex-1 py-2 rounded-xl bg-white border border-ios-borde text-[13px] font-semibold text-gray-700 active:scale-95 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
