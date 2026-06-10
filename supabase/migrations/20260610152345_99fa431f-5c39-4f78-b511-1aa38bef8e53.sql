
-- Categories enum for call list entries
CREATE TYPE public.call_category AS ENUM (
  'bavardages',
  'oubli_materiel',
  'travail_non_fait',
  'refus_travail',
  'insolence',
  'comportement_irrespectueux',
  'encouragement'
);

-- Quick attendance/behavior entries logged by teachers during a class
CREATE TABLE public.call_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  category public.call_category NOT NULL,
  message text,
  date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_entries TO authenticated;
GRANT ALL ON public.call_entries TO service_role;
ALTER TABLE public.call_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers/admin/cpe insert call entries"
ON public.call_entries FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = teacher_id
  AND (public.has_role(auth.uid(),'professeur') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cpe'))
);

CREATE POLICY "Teachers/admin/cpe update own entries"
ON public.call_entries FOR UPDATE TO authenticated
USING (auth.uid() = teacher_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cpe'))
WITH CHECK (auth.uid() = teacher_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cpe'));

CREATE POLICY "Teachers/admin/cpe delete own entries"
ON public.call_entries FOR DELETE TO authenticated
USING (auth.uid() = teacher_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cpe'));

CREATE POLICY "Read call entries: staff all, student own"
ON public.call_entries FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'cpe')
  OR public.has_role(auth.uid(),'professeur')
  OR student_id = auth.uid()
);

CREATE INDEX idx_call_entries_student ON public.call_entries(student_id, date DESC);
CREATE INDEX idx_call_entries_teacher_date ON public.call_entries(teacher_id, date DESC);

-- Report cards (bulletins)
CREATE TABLE public.bulletins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL,
  general_appreciation text,
  subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulletins TO authenticated;
GRANT ALL ON public.bulletins TO service_role;
ALTER TABLE public.bulletins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff create bulletins"
ON public.bulletins FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id
  AND (public.has_role(auth.uid(),'professeur') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cpe'))
);

CREATE POLICY "Staff/author update bulletins"
ON public.bulletins FOR UPDATE TO authenticated
USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'))
WITH CHECK (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Author/admin delete bulletins"
ON public.bulletins FOR DELETE TO authenticated
USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Read bulletins: staff all, student own published"
ON public.bulletins FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'cpe')
  OR public.has_role(auth.uid(),'professeur')
  OR (student_id = auth.uid() AND published = true)
);

CREATE TRIGGER touch_bulletins_updated_at
BEFORE UPDATE ON public.bulletins
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Allow attaching a grade to a social post (sharing a grade/appreciation on the feed)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS shared_grade_id uuid REFERENCES public.grades(id) ON DELETE SET NULL;
