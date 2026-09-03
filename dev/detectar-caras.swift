// Detecta caras con el framework Vision de macOS y escribe en JSON el rectángulo
// de cada una, en píxeles y con origen arriba-izquierda (como espera Pillow).
// Uso:  swift dev/detectar-caras.swift foto1.png foto2.png …
import Foundation
import Vision
import AppKit

struct Cara: Codable { let x: Int; let y: Int; let ancho: Int; let alto: Int; let confianza: Float }
struct Resultado: Codable { let archivo: String; let ancho: Int; let alto: Int; let caras: [Cara] }

var salida: [Resultado] = []

for ruta in CommandLine.arguments.dropFirst() {
    guard let imagen = NSImage(contentsOfFile: ruta),
          let cg = imagen.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
        FileHandle.standardError.write("No se pudo abrir \(ruta)\n".data(using: .utf8)!)
        continue
    }
    let w = cg.width, h = cg.height
    let peticion = VNDetectFaceRectanglesRequest()
    let manejador = VNImageRequestHandler(cgImage: cg, options: [:])
    var caras: [Cara] = []
    do {
        try manejador.perform([peticion])
        for obs in (peticion.results ?? []) {
            let b = obs.boundingBox            // normalizado, origen abajo-izquierda
            let px = Int(b.origin.x * CGFloat(w))
            let pw = Int(b.width * CGFloat(w))
            let ph = Int(b.height * CGFloat(h))
            // Vision mide desde abajo; Pillow desde arriba
            let py = Int((1 - b.origin.y - b.height) * CGFloat(h))
            caras.append(Cara(x: px, y: py, ancho: pw, alto: ph, confianza: obs.confidence))
        }
    } catch {
        FileHandle.standardError.write("Vision falló en \(ruta): \(error)\n".data(using: .utf8)!)
    }
    salida.append(Resultado(archivo: ruta, ancho: w, alto: h, caras: caras))
}

let datos = try JSONEncoder().encode(salida)
FileHandle.standardOutput.write(datos)
