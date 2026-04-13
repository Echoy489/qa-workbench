import { describe, it, expect, beforeEach } from 'vitest'
import './mocks/chrome'
import { resetChromeMock } from './mocks/chrome'
import {
  getProjects, addProject, addPage, addElement,
  deleteElement, deletePage, deleteProject, updateElementValidation,
} from '../src/store/xpathStore'

beforeEach(() => resetChromeMock())

describe('addProject', () => {
  it('stores a new project and returns it', async () => {
    const p = await addProject('My Project')
    expect(p.name).toBe('My Project')
    expect(p.id).toBeTruthy()
    expect(p.pages).toEqual([])
  })

  it('accumulates multiple projects', async () => {
    await addProject('A')
    await addProject('B')
    const projects = await getProjects()
    expect(projects.length).toBe(2)
  })
})

describe('addPage', () => {
  it('adds a page to the correct project', async () => {
    const proj = await addProject('Proj')
    const page = await addPage(proj.id, 'LoginPage')
    const projects = await getProjects()
    expect(projects[0].pages[0].name).toBe('LoginPage')
    expect(page.id).toBeTruthy()
  })

  it('throws for unknown project id', async () => {
    await expect(addPage('nonexistent', 'Page')).rejects.toThrow('Project not found')
  })
})

describe('addElement', () => {
  it('adds an element with enriched metadata', async () => {
    const proj = await addProject('P')
    const page = await addPage(proj.id, 'Page')
    const el = await addElement(proj.id, page.id, {
      name: 'Login Btn',
      xpath: "//button[@id='login']",
      candidates: [
        {
          strategy: 'id',
          xpath: "//button[@id='login']",
          stability: 'best',
          label: 'By ID',
          validationStatus: 'valid',
          matchCount: 1,
        },
      ],
      url: 'https://example.com/login',
      pageTitle: 'Login',
      notes: '',
    })
    expect(el.name).toBe('Login Btn')
    expect(el.xpath).toBe("//button[@id='login']")
    expect(el.validationStatus).toBe('valid')
    expect(el.matchCount).toBe(1)
  })
})

describe('updateElementValidation', () => {
  it('updates validation status and match count', async () => {
    const proj = await addProject('P')
    const page = await addPage(proj.id, 'Page')
    const el = await addElement(proj.id, page.id, {
      name: 'Btn',
      xpath: "//button[@id='x']",
      candidates: [{ strategy: 'id', xpath: "//button[@id='x']", stability: 'best', label: 'By ID' }],
      url: '', notes: '',
    })
    await updateElementValidation(proj.id, page.id, el.id, [
      { xpath: "//button[@id='x']", matchCount: 0, status: 'broken' },
    ])
    const projects = await getProjects()
    const updated = projects[0].pages[0].elements[0]
    expect(updated.validationStatus).toBe('broken')
    expect(updated.matchCount).toBe(0)
    expect(updated.lastValidated).toBeTruthy()
  })
})

describe('deleteElement / deletePage / deleteProject', () => {
  it('removes element from page', async () => {
    const proj = await addProject('P')
    const page = await addPage(proj.id, 'Page')
    const el = await addElement(proj.id, page.id, {
      name: 'Btn', xpath: '//button', candidates: [], url: '', notes: '',
    })
    await deleteElement(proj.id, page.id, el.id)
    const projects = await getProjects()
    expect(projects[0].pages[0].elements).toHaveLength(0)
  })

  it('removes a page', async () => {
    const proj = await addProject('P')
    const page = await addPage(proj.id, 'Page')
    await deletePage(proj.id, page.id)
    const projects = await getProjects()
    expect(projects[0].pages).toHaveLength(0)
  })

  it('removes a project', async () => {
    const proj = await addProject('P')
    await deleteProject(proj.id)
    expect(await getProjects()).toHaveLength(0)
  })
})
