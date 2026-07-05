#!/bin/bash
# Convierte las imágenes PNG de CRT Journal a WebP
# Requiere: sudo apt install webp   (o brew install webp en Mac)
# Ejecutar desde: /home/cesar/crt-journal-fix

mkdir -p public/webp

URLS=(
  "https://i.ibb.co/Y76QqzC6/Captura-de-pantalla-2026-05-15-111218.png"
  "https://i.ibb.co/4ZSrjPsV/Captura-de-pantalla-2026-05-15-111306.png"
  "https://i.ibb.co/1fGSfhfB/Captura-de-pantalla-2026-05-15-111323.png"
  "https://i.ibb.co/wFxMQ0QG/Captura-de-pantalla-2026-05-15-111343.png"
  "https://i.ibb.co/B5C2SvZC/Captura-de-pantalla-2026-05-15-111422.png"
  "https://i.ibb.co/5gkfzBXN/Whats-App-Image-2026-05-16-at-18-50-39.jpg"
)

for url in "${URLS[@]}"; do
  name=$(basename "$url" | sed 's/\.[^.]*$//')
  echo "Convirtiendo: $name"
  curl -sL "$url" -o "/tmp/$name.orig"
  ext=$(echo "$url" | grep -o '\.\(png\|jpg\)$')
  cwebp -q 80 "/tmp/$name.orig" -o "public/webp/${name}.webp" 2>/dev/null
  orig_size=$(stat -c%s "/tmp/$name.orig" 2>/dev/null || stat -f%z "/tmp/$name.orig")
  webp_size=$(stat -c%s "public/webp/${name}.webp" 2>/dev/null || stat -f%z "public/webp/${name}.webp")
  saving=$((100 - webp_size * 100 / orig_size))
  echo "  Original: ${orig_size}B → WebP: ${webp_size}B (${saving}% ahorro)"
  rm "/tmp/$name.orig"
done

echo ""
echo "WebP generados en public/webp/"
echo "Súbelos a tu hosting de imágenes y reemplaza las URLs en index.html"
