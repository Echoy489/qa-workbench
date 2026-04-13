import type {
  XPathProject, XPathPage, XPathElement, XPathCandidate,
  XPathValidationStatus, ValidationResult,
} from '../shared/types'

const KEY = 'qa_xpath_projects'

export async function getProjects(): Promise<XPathProject[]> {
  const r = await chrome.storage.local.get(KEY)
  return (r[KEY] as XPathProject[]) || []
}

async function saveProjects(projects: XPathProject[]): Promise<void> {
  await chrome.storage.local.set({ [KEY]: projects })
}

export async function addProject(name: string): Promise<XPathProject> {
  const projects = await getProjects()
  const p: XPathProject = {
    id: crypto.randomUUID(),
    name: name.trim(),
    pages: [],
    createdAt: new Date().toISOString(),
  }
  await saveProjects([...projects, p])
  return p
}

export async function addPage(projectId: string, name: string): Promise<XPathPage> {
  const projects = await getProjects()
  const proj = projects.find(p => p.id === projectId)
  if (!proj) throw new Error('Project not found')
  const page: XPathPage = { id: crypto.randomUUID(), name: name.trim(), elements: [] }
  proj.pages.push(page)
  await saveProjects(projects)
  return page
}

export async function addElement(
  projectId: string,
  pageId: string,
  data: {
    name: string
    xpath: string
    candidates: XPathCandidate[]
    fallbacks?: string[]
    url: string
    pageTitle?: string
    notes: string
    attrSnapshot?: Record<string, string>
  }
): Promise<XPathElement> {
  const projects = await getProjects()
  const proj = projects.find(p => p.id === projectId)
  if (!proj) throw new Error('Project not found')
  const page = proj.pages.find(p => p.id === pageId)
  if (!page) throw new Error('Page not found')

  const primaryCandidate = data.candidates.find(c => c.xpath === data.xpath)

  const el: XPathElement = {
    ...data,
    id: crypto.randomUUID(),
    validationStatus: primaryCandidate?.validationStatus ?? 'unknown',
    matchCount: primaryCandidate?.matchCount,
    attrSnapshot: data.attrSnapshot,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  page.elements.push(el)
  await saveProjects(projects)
  return el
}

/** Apply validation results returned from the content script to a saved element. */
export async function updateElementValidation(
  projectId: string,
  pageId: string,
  elementId: string,
  results: ValidationResult[],
): Promise<void> {
  const projects = await getProjects()
  const proj = projects.find(p => p.id === projectId)
  if (!proj) return
  const page = proj.pages.find(p => p.id === pageId)
  if (!page) return
  const el = page.elements.find(e => e.id === elementId)
  if (!el) return

  const now = new Date().toISOString()
  const primary = results.find(r => r.xpath === el.xpath)
  if (primary) {
    el.validationStatus = primary.status
    el.matchCount = primary.matchCount
  }

  // Update per-candidate validation status
  el.candidates = el.candidates.map(c => {
    const r = results.find(vr => vr.xpath === c.xpath)
    return r ? { ...c, validationStatus: r.status, matchCount: r.matchCount } : c
  })

  el.lastValidated = now
  el.updatedAt = now

  await saveProjects(projects)
}

export async function deleteElement(projectId: string, pageId: string, elementId: string): Promise<void> {
  const projects = await getProjects()
  const proj = projects.find(p => p.id === projectId)
  if (!proj) return
  const page = proj.pages.find(p => p.id === pageId)
  if (!page) return
  page.elements = page.elements.filter(e => e.id !== elementId)
  await saveProjects(projects)
}

export async function deletePage(projectId: string, pageId: string): Promise<void> {
  const projects = await getProjects()
  const proj = projects.find(p => p.id === projectId)
  if (!proj) return
  proj.pages = proj.pages.filter(p => p.id !== pageId)
  await saveProjects(projects)
}

export async function deleteProject(projectId: string): Promise<void> {
  const projects = await getProjects()
  await saveProjects(projects.filter(p => p.id !== projectId))
}
