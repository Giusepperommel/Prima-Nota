import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getUtenteAziendeCount, mapRuoloForSession } from "@/lib/auth-utils";

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

        // Count how many aziende this user belongs to
        const numeroAziende = await getUtenteAziendeCount(utente.id);

        // Read nome/cognome from Utente first, fallback to Socio (transition period)
        const nome = utente.nome ?? utente.socio?.nome ?? "";
        const cognome = utente.cognome ?? utente.socio?.cognome ?? "";
        const isSuperAdmin = utente.isSuperAdmin ?? false;

        let societaId: number | null = null;
        let socioId: number | null = null;
        let ruolo = "STANDARD";
        let ruoloAzienda: string | null = null;
        let quotaPercentuale = 0;

        if (numeroAziende === 1) {
          // Auto-select the single azienda
          const ua = await prisma.utenteAzienda.findFirst({
            where: { utenteId: utente.id, attivo: true },
          });

          if (ua) {
            // Check UtenteAzienda is active
            if (!ua.attivo) return null;

            societaId = ua.societaId;
            ruoloAzienda = ua.ruolo;
            ruolo = mapRuoloForSession(ua.ruolo);

            // Find Socio for this azienda (may be null for commercialista)
            const socio = await prisma.socio.findFirst({
              where: { utenteId: utente.id, societaId: ua.societaId },
            });

            if (socio) {
              if (!socio.attivo) return null;
              socioId = socio.id;
              quotaPercentuale = Number(socio.quotaPercentuale);
            }

            // Update ultimo accesso on UtenteAzienda
            await prisma.utenteAzienda.update({
              where: { id: ua.id },
              data: { ultimoAccesso: new Date() },
            });
          }
        } else if (numeroAziende === 0) {
          // Legacy fallback: user with Socio but no UtenteAzienda yet
          if (utente.socio) {
            if (!utente.socio.attivo) return null;
            socioId = utente.socio.id;
            societaId = utente.socio.societaId;
            ruolo = utente.socio.ruolo === "SUPER_ADMIN" ? "ADMIN" : utente.socio.ruolo;
            quotaPercentuale = Number(utente.socio.quotaPercentuale);
          }
        }
        // If numeroAziende > 1: societaId stays null, user must pick

        await prisma.utente.update({
          where: { id: utente.id },
          data: { ultimoAccesso: new Date() },
        });

        return {
          id: String(utente.id),
          email: utente.email,
          nome,
          cognome,
          ruolo,
          ruoloAzienda,
          isSuperAdmin,
          socioId,
          societaId,
          quotaPercentuale,
          emailVerificata: utente.emailVerificata,
          modalitaAvanzata: utente.modalitaAvanzata,
          modalitaCommercialista: utente.modalitaCommercialista,
          numeroAziende,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = Number(user.id);
        token.nome = (user as any).nome;
        token.cognome = (user as any).cognome;
        token.ruolo = (user as any).ruolo;
        token.ruoloAzienda = (user as any).ruoloAzienda;
        token.isSuperAdmin = (user as any).isSuperAdmin;
        token.socioId = (user as any).socioId;
        token.societaId = (user as any).societaId;
        token.quotaPercentuale = (user as any).quotaPercentuale;
        token.emailVerificata = (user as any).emailVerificata;
        token.modalitaAvanzata = (user as any).modalitaAvanzata;
        token.modalitaCommercialista = (user as any).modalitaCommercialista;
        token.numeroAziende = (user as any).numeroAziende;
      }

      // Update token when client calls update()
      if (trigger === "update" && session) {
        // Switch-societa: look up UtenteAzienda for the new societa
        if (session.societaId !== undefined) {
          const newSocietaId = session.societaId as number | null;

          if (newSocietaId != null) {
            const utenteId = token.id as number;
            const ua = await prisma.utenteAzienda.findUnique({
              where: { utenteId_societaId: { utenteId, societaId: newSocietaId } },
            });

            if (ua && ua.attivo) {
              token.societaId = ua.societaId;
              token.ruoloAzienda = ua.ruolo;
              token.ruolo = mapRuoloForSession(ua.ruolo);

              // Find Socio for this azienda
              const socio = await prisma.socio.findFirst({
                where: { utenteId, societaId: newSocietaId },
              });

              if (socio) {
                token.socioId = socio.id;
                token.quotaPercentuale = Number(socio.quotaPercentuale);
              } else {
                token.socioId = null;
                token.quotaPercentuale = 0;
              }

              // Update ultimo accesso
              await prisma.utenteAzienda.update({
                where: { id: ua.id },
                data: { ultimoAccesso: new Date() },
              });
            }
          } else {
            token.societaId = null;
            token.socioId = null;
            token.ruoloAzienda = null;
            token.quotaPercentuale = 0;
          }
        }

        if (session.ruolo !== undefined) token.ruolo = session.ruolo;
        if (session.modalitaAvanzata !== undefined) token.modalitaAvanzata = session.modalitaAvanzata;
        if (session.modalitaCommercialista !== undefined) token.modalitaCommercialista = session.modalitaCommercialista;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).nome = token.nome;
        (session.user as any).cognome = token.cognome;
        (session.user as any).ruolo = token.ruolo;
        (session.user as any).ruoloAzienda = token.ruoloAzienda;
        (session.user as any).isSuperAdmin = token.isSuperAdmin;
        (session.user as any).socioId = token.socioId;
        (session.user as any).societaId = token.societaId;
        (session.user as any).quotaPercentuale = token.quotaPercentuale;
        (session.user as any).emailVerificata = token.emailVerificata;
        (session.user as any).modalitaAvanzata = token.modalitaAvanzata;
        (session.user as any).modalitaCommercialista = token.modalitaCommercialista;
        (session.user as any).numeroAziende = token.numeroAziende;
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
