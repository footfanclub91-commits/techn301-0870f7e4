-- ============ EMPLOI DU TEMPS ============
CREATE TABLE public.timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  room text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_slots TO authenticated;
GRANT ALL ON public.timetable_slots TO service_role;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timetable read" ON public.timetable_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "timetable staff write" ON public.timetable_slots FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professeur'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'professeur'));

-- ============ CAHIER DE TEXTES ============
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_date date NOT NULL,
  content text NOT NULL,
  homework text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons read" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "lessons teacher insert" ON public.lessons FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND (public.has_role(auth.uid(), 'professeur') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "lessons own update" ON public.lessons FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "lessons own delete" ON public.lessons FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER lessons_touch BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ REPUBLICATIONS (reposts) ============
CREATE TABLE public.reposts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reposts TO authenticated;
GRANT ALL ON public.reposts TO service_role;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reposts read" ON public.reposts FOR SELECT TO authenticated USING (true);
CREATE POLICY "reposts own insert" ON public.reposts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reposts own delete" ON public.reposts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ STORIES (24h) ============
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  color text NOT NULL DEFAULT 'indigo',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stories TO authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stories read active" ON public.stories FOR SELECT TO authenticated USING (expires_at > now());
CREATE POLICY "stories own insert" ON public.stories FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "stories own delete" ON public.stories FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ MESSAGERIE (conversations) ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  is_group boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

CREATE TABLE public.conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_members TO authenticated;
GRANT ALL ON public.conversation_members TO service_role;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- Fonction security definer pour éviter la récursion RLS
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE user_id = _user_id AND conversation_id = _conversation_id
  )
$$;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv member read" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(auth.uid(), id) OR created_by = auth.uid());
CREATE POLICY "conv create" ON public.conversations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "conv creator update" ON public.conversations FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "conv creator delete" ON public.conversations FOR DELETE TO authenticated USING (created_by = auth.uid());

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON public.conversation_members FOR SELECT TO authenticated
  USING (public.is_conversation_member(auth.uid(), conversation_id));
CREATE POLICY "members add by creator" ON public.conversation_members FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT created_by FROM public.conversations c WHERE c.id = conversation_id) = auth.uid()
    OR user_id = auth.uid()
  );
CREATE POLICY "members self leave" ON public.conversation_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR (SELECT created_by FROM public.conversations c WHERE c.id = conversation_id) = auth.uid());

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages member read" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(auth.uid(), conversation_id));
CREATE POLICY "messages member send" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_member(auth.uid(), conversation_id));
CREATE POLICY "messages own delete" ON public.messages FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- Temps réel pour la messagerie
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;