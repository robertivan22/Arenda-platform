-- ============================================================
-- Migration: D112-specific columns on company_settings
-- Run in Supabase SQL Editor for project hsaomcgssyyxroezhgcp
-- ============================================================

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS d112_caen            VARCHAR(6)   DEFAULT '0111',
  ADD COLUMN IF NOT EXISTS d112_casa_ang        VARCHAR(4)   DEFAULT 'IS',
  ADD COLUMN IF NOT EXISTS d112_fax_soc         VARCHAR(30),
  ADD COLUMN IF NOT EXISTS d112_adr_fisc        TEXT,
  ADD COLUMN IF NOT EXISTS d112_tel_fisc        VARCHAR(30),
  ADD COLUMN IF NOT EXISTS d112_fax_fisc        VARCHAR(30),
  ADD COLUMN IF NOT EXISTS d112_mail_fisc       VARCHAR(120),
  ADD COLUMN IF NOT EXISTS d112_tip_rec         SMALLINT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS d112_d_rec           SMALLINT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS d112_nume_declar     VARCHAR(100),
  ADD COLUMN IF NOT EXISTS d112_prenume_declar  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS d112_functie_declar  VARCHAR(80)  DEFAULT 'Administrator';

COMMENT ON COLUMN public.company_settings.d112_caen           IS 'Cod CAEN angajator (D112 campul caen)';
COMMENT ON COLUMN public.company_settings.d112_casa_ang       IS 'Casa asigurarilor de sanatate a angajatorului (D112 casaAng)';
COMMENT ON COLUMN public.company_settings.d112_fax_soc        IS 'Fax sediu social (D112 faxSoc)';
COMMENT ON COLUMN public.company_settings.d112_adr_fisc       IS 'Adresa fiscala (D112 adrFisc) — blank = identica cu adrSoc';
COMMENT ON COLUMN public.company_settings.d112_tel_fisc       IS 'Telefon fiscal (D112 telFisc)';
COMMENT ON COLUMN public.company_settings.d112_fax_fisc       IS 'Fax fiscal (D112 faxFisc)';
COMMENT ON COLUMN public.company_settings.d112_mail_fisc      IS 'Email fiscal (D112 mailFisc)';
COMMENT ON COLUMN public.company_settings.d112_tip_rec        IS '0=declaratie normala, 1=declaratie rectificativa';
COMMENT ON COLUMN public.company_settings.d112_d_rec          IS 'Luna declaratiei rectificate (0 daca tip_rec=0)';
COMMENT ON COLUMN public.company_settings.d112_nume_declar    IS 'Numele declarantului (persoana care semneaza D112)';
COMMENT ON COLUMN public.company_settings.d112_prenume_declar IS 'Prenumele declarantului';
COMMENT ON COLUMN public.company_settings.d112_functie_declar IS 'Functia declarantului (default Administrator)';
