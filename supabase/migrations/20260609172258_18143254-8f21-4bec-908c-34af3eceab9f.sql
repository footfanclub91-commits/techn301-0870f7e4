
ALTER TABLE public.posts      ADD CONSTRAINT posts_author_profile_fkey      FOREIGN KEY (author_id)  REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.comments   ADD CONSTRAINT comments_author_profile_fkey   FOREIGN KEY (author_id)  REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.incidents  ADD CONSTRAINT incidents_student_profile_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.incidents  ADD CONSTRAINT incidents_author_profile_fkey  FOREIGN KEY (author_id)  REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.grades     ADD CONSTRAINT grades_student_profile_fkey    FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.grades     ADD CONSTRAINT grades_teacher_profile_fkey    FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.homework   ADD CONSTRAINT homework_teacher_profile_fkey  FOREIGN KEY (teacher_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_profile_fkey        FOREIGN KEY (user_id)    REFERENCES public.profiles(id) ON DELETE CASCADE;
