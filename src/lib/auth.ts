import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const utente = await prisma.utente.findUnique({
          where: { email: credentials.email as string },
          include: { socio: true },
        });

        if (!utente) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          utente.passwordHash
        );

        if (!passwordMatch) return null;
        if (!utente.socio.attivo) return null;

        await prisma.utente.update({
          where: { id: utente.id },
          data: { ultimoAccesso: new Date() },
        });

        return {
          id: String(utente.id),
          email: utente.email,
          nome: utente.socio.nome,
          cognome: utente.socio.cognome,
          ruolo: utente.socio.ruolo,
          socioId: utente.socio.id,
          societaId: utente.socio.societaId,
          quotaPercentuale: Number(utente.socio.quotaPercentuale),
          emailVerificata: utente.emailVerificata,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = Number(user.id);
        token.nome = (user as any).nome;
        token.cognome = (user as any).cognome;
        token.ruolo = (user as any).ruolo;
        token.socioId = (user as any).socioId;
        token.societaId = (user as any).societaId;
        token.quotaPercentuale = (user as any).quotaPercentuale;
        token.emailVerificata = (user as any).emailVerificata;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).nome = token.nome;
        (session.user as any).cognome = token.cognome;
        (session.user as any).ruolo = token.ruolo;
        (session.user as any).socioId = token.socioId;
        (session.user as any).societaId = token.societaId;
        (session.user as any).quotaPercentuale = token.quotaPercentuale;
        (session.user as any).emailVerificata = token.emailVerificata;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
