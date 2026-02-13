import { auth } from "@/lib/auth";

const publicPaths = ["/login", "/registrazione", "/verifica-email", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

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

  // Se email non verificata, redirect a verifica
  const user = req.auth.user as any;
  if (user && !user.emailVerificata) {
    const verificaUrl = new URL("/verifica-email", req.url);
    verificaUrl.searchParams.set("email", user.email);
    return Response.redirect(verificaUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
