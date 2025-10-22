-- Create a custom type for user roles
CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'bot_manager', 'member');

-- Create the organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT,
  cnpj TEXT,
  address JSONB,
  contacts JSONB,
  contract JSONB,
  smtp JSONB,
  notifications JSONB,
  llm_providers JSONB,
  branding JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create the profiles table to extend auth.users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role user_role DEFAULT 'member' NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  last_login TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Function to create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create the agents table
CREATE TABLE public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  model TEXT,
  system_prompt TEXT,
  status TEXT DEFAULT 'active' NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  version INT DEFAULT 1,
  usage_count INT DEFAULT 0,
  tags JSONB
);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Organizations are viewable by members of the organization" ON public.organizations
  FOR SELECT USING (id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Owners can update their own organization" ON public.organizations
  FOR UPDATE USING (id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner');

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins and owners can view profiles in their organization" ON public.profiles
  FOR SELECT USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner'));

-- RLS Policies for agents
CREATE POLICY "Users can view agents in their organization" ON public.agents
  FOR SELECT USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Managers, admins, and owners can create agents" ON public.agents
  FOR INSERT WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('bot_manager', 'admin', 'owner'));

CREATE POLICY "Managers, admins, and owners can update agents" ON public.agents
  FOR UPDATE USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('bot_manager', 'admin', 'owner'));

CREATE POLICY "Managers, admins, and owners can delete agents" ON public.agents
  FOR DELETE USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('bot_manager', 'admin', 'owner'));
