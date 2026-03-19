import { auth } from "@/lib/auth";

const publicPaths = ["/login", "/registrazione", "/verifica-email", "/reset-password", "/api/auth"];
const noSocietaRequiredPaths = ["/crea-societa", "/api/societa"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Consenti accesso alla landing page
  if (pathname === "/") {
    return;
  }

  // Consenti accesso alle rotte pubbliche
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return;
  }

  // Se non autenticato, redirect a login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  const user = req.auth.user as any;

  // Se email non verificata, redirect a verifica
  if (user && !user.emailVerificata) {
    const verificaUrl = new URL("/verifica-email", req.url);
    verificaUrl.searchParams.set("email", user.email);
    return Response.redirect(verificaUrl);
  }

  // Se l'utente non ha una societa associata, redirect a creazione societa
  // (SUPER_ADMIN puo' navigare senza societa)
  if (
    user &&
    user.societaId == null &&
    user.ruolo !== "SUPER_ADMIN" &&
    !noSocietaRequiredPaths.some((path) => pathname.startsWith(path))
  ) {
    const creaSocietaUrl = new URL("/crea-societa", req.url);
    return Response.redirect(creaSocietaUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
