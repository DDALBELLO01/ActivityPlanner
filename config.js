// Configurazione Supabase
const SUPABASE_URL = 'https://ouxvlyaksbfvqmdryzpn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91eHZseWFrc2JmdnFtZHJ5enBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1NDA3ODUsImV4cCI6MjA3MTExNjc4NX0.NWvgiCIhqNA6wLr6ARAJrQjItMfZZ78JZ6IwlkomZkI';

/* 
❌ PROBLEMA RLS RILEVATO! 
Se vedi errori come "infinite recursion detected in policy for relation utenti (42P17)",
esegui il file fix-rls-policies.sql nell'editor SQL di Supabase.

ALTERNATIVA RAPIDA - DISABILITA TEMPORANEAMENTE RLS:
ALTER TABLE public.utenti DISABLE ROW LEVEL SECURITY;

COPIA E INCOLLA QUESTO SQL NELL'EDITOR SQL DI SUPABASE:

-- 1. Aggiungi campo unita_id alla tabella attivita
ALTER TABLE public.attivita 
ADD COLUMN unita_id bigint REFERENCES public.unita(id);

-- 2. Aggiungi campo unita_id alla tabella membri  
ALTER TABLE public.membri 
ADD COLUMN unita_id bigint REFERENCES public.unita(id);

-- 3. Aggiungi indici per performance
CREATE INDEX idx_attivita_unita_id ON public.attivita(unita_id);
CREATE INDEX idx_membri_unita_id ON public.membri(unita_id);

-- 4. Abilita Row Level Security
ALTER TABLE public.attivita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utenti ENABLE ROW LEVEL SECURITY;

-- 5. Politiche per attivita
DROP POLICY IF EXISTS "Users can view activities" ON public.attivita;
CREATE POLICY "Users can view activities" ON public.attivita
FOR SELECT USING (
  unita_id = ANY(
    SELECT unnest(unita_visibili) 
    FROM public.utenti 
    WHERE email = auth.jwt() ->> 'email'
  ) OR
  EXISTS (
    SELECT 1 FROM public.utenti
    WHERE email = auth.jwt() ->> 'email' AND admin = true
  )
);

DROP POLICY IF EXISTS "Leaders can manage activities" ON public.attivita;
CREATE POLICY "Leaders can manage activities" ON public.attivita
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.utenti u
    JOIN public.unita un ON u.id = un.capo_unita
    WHERE u.email = auth.jwt() ->> 'email' AND un.id = unita_id
  ) OR
  EXISTS (
    SELECT 1 FROM public.utenti u
    JOIN public.unita un ON u.id = ANY(un.aiuti)
    WHERE u.email = auth.jwt() ->> 'email' AND un.id = unita_id
  ) OR
  EXISTS (
    SELECT 1 FROM public.utenti
    WHERE email = auth.jwt() ->> 'email' AND admin = true
  )
);

-- 6. Politiche per membri
DROP POLICY IF EXISTS "Users can view members" ON public.membri;
CREATE POLICY "Users can view members" ON public.membri
FOR SELECT USING (
  unita_id = ANY(
    SELECT unnest(unita_visibili) 
    FROM public.utenti 
    WHERE email = auth.jwt() ->> 'email'
  ) OR
  EXISTS (
    SELECT 1 FROM public.utenti
    WHERE email = auth.jwt() ->> 'email' AND admin = true
  )
);

DROP POLICY IF EXISTS "Leaders can manage members" ON public.membri;
CREATE POLICY "Leaders can manage members" ON public.membri
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.utenti u
    JOIN public.unita un ON u.id = un.capo_unita
    WHERE u.email = auth.jwt() ->> 'email' AND un.id = unita_id
  ) OR
  EXISTS (
    SELECT 1 FROM public.utenti u
    JOIN public.unita un ON u.id = ANY(un.aiuti)
    WHERE u.email = auth.jwt() ->> 'email' AND un.id = unita_id
  ) OR
  EXISTS (
    SELECT 1 FROM public.utenti
    WHERE email = auth.jwt() ->> 'email' AND admin = true
  )
);

-- 7. Politiche per unita
DROP POLICY IF EXISTS "Users can view units" ON public.unita;
CREATE POLICY "Users can view units" ON public.unita
FOR SELECT USING (
  id = ANY(
    SELECT unnest(unita_visibili) 
    FROM public.utenti 
    WHERE email = auth.jwt() ->> 'email'
  ) OR
  EXISTS (
    SELECT 1 FROM public.utenti
    WHERE email = auth.jwt() ->> 'email' AND admin = true
  )
);

DROP POLICY IF EXISTS "Admins can manage units" ON public.unita;
CREATE POLICY "Admins can manage units" ON public.unita
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.utenti
    WHERE email = auth.jwt() ->> 'email' AND admin = true
  )
);

-- 8. Politiche per utenti
DROP POLICY IF EXISTS "Users can view themselves" ON public.utenti;
CREATE POLICY "Users can view themselves" ON public.utenti
FOR SELECT USING (
  email = auth.jwt() ->> 'email' OR
  EXISTS (
    SELECT 1 FROM public.utenti
    WHERE email = auth.jwt() ->> 'email' AND admin = true
  )
);

DROP POLICY IF EXISTS "Users can update themselves" ON public.utenti;
CREATE POLICY "Users can update themselves" ON public.utenti
FOR UPDATE USING (
  email = auth.jwt() ->> 'email' OR
  EXISTS (
    SELECT 1 FROM public.utenti
    WHERE email = auth.jwt() ->> 'email' AND admin = true
  )
);

-- 9. Trigger per aggiornare automaticamente nr_membri
CREATE OR REPLACE FUNCTION update_unit_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.unita_id IS NOT NULL THEN
    UPDATE public.unita 
    SET nr_membri = (SELECT COUNT(*) FROM public.membri WHERE unita_id = NEW.unita_id)
    WHERE id = NEW.unita_id;
  ELSIF TG_OP = 'DELETE' AND OLD.unita_id IS NOT NULL THEN
    UPDATE public.unita 
    SET nr_membri = (SELECT COUNT(*) FROM public.membri WHERE unita_id = OLD.unita_id)
    WHERE id = OLD.unita_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.unita_id IS DISTINCT FROM NEW.unita_id THEN
      IF OLD.unita_id IS NOT NULL THEN
        UPDATE public.unita 
        SET nr_membri = (SELECT COUNT(*) FROM public.membri WHERE unita_id = OLD.unita_id)
        WHERE id = OLD.unita_id;
      END IF;
      IF NEW.unita_id IS NOT NULL THEN
        UPDATE public.unita 
        SET nr_membri = (SELECT COUNT(*) FROM public.membri WHERE unita_id = NEW.unita_id)
        WHERE id = NEW.unita_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_member_count ON public.membri;
CREATE TRIGGER trigger_update_member_count
  AFTER INSERT OR UPDATE OR DELETE ON public.membri
  FOR EACH ROW EXECUTE FUNCTION update_unit_member_count();

*/
