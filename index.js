import { ref, defineComponent, h, cloneVNode, watch, nextTick } from "vue"

export const viewList = ref([])
export const currentView = ref()
let nextId = 0
let hookIndex = undefined
let nextUniqueKey = 0

export function getUniqueKey () {
  return ++nextUniqueKey
}

watch(currentView, (newId, oldId) => {
  const { onDeactivate } = viewList.value.find(({ id }) => id === oldId) ?? {}
  onDeactivate?.()
  const { onActivate } = viewList.value.find(({ id }) => id === newId) ?? {}
  onActivate?.()
})

let viewStack = []

export function onActivate (fn) {
  if (hookIndex !== undefined) {
    viewList.value[hookIndex].onActivate = fn
  }
}
export function onDeactivate (fn) {
  if (hookIndex !== undefined) {
    viewList.value[hookIndex].onDeactivate = fn
  }
}
export function useMdiInterface ({ title, onActivate, onDeactivate }) {
  if (hookIndex !== undefined) {
    viewList.value[hookIndex].title = title
    viewList.value[hookIndex].onActivate = onActivate
    viewList.value[hookIndex].onDeactivate = onDeactivate
  }
}

export async function openView (module, props, uniqueKey, parent) {
  const importedModule = await module()
  const component = importedModule.default

  const { __name, __file } = component
  const name = __name ?? __file.substring(__file.lastIndexOf("/") + 1, __file.lastIndexOf("."))

  const view = viewList.value.find(v =>
    v.name === name && v.uniqueKey === uniqueKey
  )

  if (view) {
    currentView.value = view.id
    viewStack = viewStack.filter(i => i !== view.id)
    view.props = props
  } else {
    viewList.value.push({ component, title: name, name, props: ref(props), uniqueKey, parent, id: ++nextId, onActivate: undefined, onDeactivate: undefined })
    hookIndex = viewList.value.length - 1
    nextTick().then(() => hookIndex = undefined)
    currentView.value = nextId
  }
  viewStack.unshift(nextId)
}

export function activateView (viewId) {
  if (viewId) {
    const { id } = viewList.value.find(({ id }) => id === viewId) ?? {}
    currentView.value = id
  } else {
    currentView.value = undefined
  }
}

export function closeView (viewId) {
  const viewIndex = viewList.value.findIndex(({ id }) => id === viewId)
  if (viewIndex === -1) return

  const { id } = viewList.value[viewIndex]
  viewStack = viewStack.filter(i => i !== id)
  if (currentView.value === id) {
    currentView.value = viewStack[0]
  }
  viewList.value.splice(viewIndex, 1)
}

export function closeAllViews () {
  viewList.value = []
  currentView.value = undefined
}

const MdiViewComponent = defineComponent({
  name: 'MdiView',
  props: {
    group: String
  },
  setup (props, { slots }) {
    return () => {
      const defaultVNodes = slots.default().map(vNode => ({ vNode, show: currentView.value === undefined }))
      const vNodes = [...defaultVNodes, ...viewList.value.map(({ component, props, id }) => ({ vNode: h(component, { ...props, key: id }), show: currentView.value === id }))]
      return vNodes.map(({ vNode, show }) => show ? vNode : cloneVNode(vNode, { style: { display: 'none' } }))
    }
  }
})

export const createMdiInterface = {
  install (app, options) {
    app.component('MdiView', MdiViewComponent)
  }
}
