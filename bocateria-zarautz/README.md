# Bocateria Zarautz — Demo de Pedidos a Toldo

Demo funcional del sistema de pedidos digitales para la bocateria.

## Abrir la demo

Doble clic en `index.html` → se abre en el navegador.

O para compartirla online en 2 minutos:
1. Ve a https://app.netlify.com/drop
2. Arrastra esta carpeta completa (`bocateria-zarautz/`) sobre la pagina
3. Copia la URL que te genera y mandasela al cliente

## Que incluye

- Menu con 5 bocadillos reales con fotos
- Personalizacion de ingredientes (quitar / anadir extras con precio)
- Formulario de datos: Numero de Toldo, Nombre, Telefono
- Carrito lateral con control de cantidades
- Barra flotante inferior (mobile-first)
- Checkout de 3 pasos con selector de pago:
  - **Pagar ahora** (Apple Pay / Tarjeta)
  - **Pagar en la entrega** (Efectivo o datafono)
- Mensaje de WhatsApp automatico a la cocina con todos los datos

## Para personalizar

- **Numero de WhatsApp del local**: busca `34600000000` en `index.html` y cambia por el numero real
- **Precios y productos**: edita las funciones `addToCart(...)` y el HTML de cada tarjeta
- **Nombre del negocio**: busca `ZARAUTZ 360` en el HTML

## Stack

HTML + Tailwind CSS (CDN) + GSAP + Lucide Icons. Sin dependencias, sin build. Un solo archivo.
