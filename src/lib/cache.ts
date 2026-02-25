import { cache } from 'react'
import { supabase } from '@/lib/supabase'

export const getProjects = cache(async () => {
  const { data } = await supabase.from('projects').select('*')
  return data || []
})

export const getStats = cache(async () => {
  const projects = await getProjects()
  return {
    total: projects.length,
    active: projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
  }
})
