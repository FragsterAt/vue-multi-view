import { ref, defineComponent, h, cloneVNode, nextTick, unref, toRef, computed } from 'vue'

export let ZERO_VIEW_ID = 0

export const viewList = ref([])
const _currentView = ref(ZERO_VIEW_ID)
export const currentView = computed({
  get: () => _currentView.value,
  set: async (viewId) => {
    if (_currentView.value === viewId) return // don't change view
    if (_currentView.value !== ZERO_VIEW_ID) { // try to deactivate old view
      const { hooks: { onDeactivate = () => true } } = viewById(_currentView.value) ?? {}
      if (await onDeactivate(viewId, _currentView.value) === false) return // fail (
    }

    if (viewId === ZERO_VIEW_ID) {
      _currentView.value = viewId
      return
    }

    // go to another view
    const view = viewById(viewId)
    if (!view) { // wrong id
      _currentView.value = ZERO_VIEW_ID
      return
    }

    const { hooks: { onActivate = () => true } } = view
    if (await onActivate(_currentView.value, viewId) === false) { // failed to activate new view
      if (_currentView.value === ZERO_VIEW_ID) { return }

      // try to activate old view
      const { hooks: { onActivate = () => true } } = viewById(_currentView.value) ?? {}

      if (await onActivate(viewId, _currentView.value) === false) { // failed, go to zero view
        _currentView.value = ZERO_VIEW_ID
        return
      }
    }

    _currentView.value = viewId
  }
})
let nextId = 0
let hookIndex
let nextUniqueKey = 0
const possibleViews = {}

export function getUniqueKey () {
  return ++nextUniqueKey
}

function viewById (id) {
  return viewList.value.find(({ viewId }) => viewId === id)
}

let viewStack = []

/**
 *
 * @param {Function(fromId, toId)} [fn] - if undefined - unregister callback, if returned false, try to activate previous view or zero if both fails. Use with caution
 * @param {Number} [viewId] - if not in created/setup - view id to attach callback
 * @returns
 */
export function onActivate (fn, viewId) {
  if (hookIndex !== undefined) {
    viewList.value[hookIndex].hooks.onActivate = fn
  } else if (viewId) {
    const view = viewById(viewId)
    if (!view) return
    view.hooks.onActivate = fn
  }
}
/**
 *
 * @param {Function(toId, fromId)} [fn] - if undefined - unregister callback, if returned false, not deactivate view. Use with caution
 * @param {Number} [viewId] - if not in created/setup - view id to attach callback
 * @returns
 */
export function onDeactivate (fn, viewId) {
  if (hookIndex !== undefined) {
    viewList.value[hookIndex].hooks.onDeactivate = fn
  } else if (viewId) {
    const view = viewById(viewId)
    if (!view) return
    view.hooks.onDeactivate = fn
  }
}
/**
 *
 * @param {Function} [fn] - if undefined - unregister callback, if returned false - don't close view
 * @param {Number} [viewId] - if not in created/setup - view id to attach callback
 * @returns
 */
export function onBeforeClose (fn, viewId) {
  if (hookIndex !== undefined) {
    viewList.value[hookIndex].hooks.onBeforeClose = fn
  } else if (viewId) {
    const view = viewById(viewId)
    if (!view) return
    view.hooks.onBeforeClose = fn
  }
}

export function useMdiInterface ({ title, uniqueKey, meta = {} } = {}) {
  const res = { currentView }

  if (hookIndex !== undefined) {
    const view = viewList.value[hookIndex]
    view.title = title ?? view.title
    view.uniqueKey = uniqueKey ?? view.uniqueKey

    Object.assign(view.meta, meta)
    const { viewId, parentViewId } = view
    Object.assign(res, { viewId, parentViewId, uniqueKey: view.uniqueKey })
  }
  return res
}

/**
 *
 * @param {String} name - one of registered with createMdiInterface views key
 * @param {*} props - props passed to view component
 * @param {String|Number} uniqueKey - unique key to search view with specified name, if find - activate view
 * @param {Object} options
 * @property {Number} [options.parentViewId] - if specified and parent view is closed - close before all descendant views
 * @property {Boolean} [options.inBackground=false] - do not activate opened view
 * @returns {Number} id of opened view
 */
export async function openView (name, props, uniqueKey, { parentViewId, inBackground = false } = {}) {
  if (!possibleViews[name]) throw new Error(`Wrong view '${name}', available names are: ${Object.keys(possibleViews)}`)
  const importedModule = await possibleViews[name]()
  const component = importedModule.default

  let view = viewList.value.find(v =>
    v.name === name && unref(v.uniqueKey) === unref(uniqueKey) && v.parentViewId === parentViewId
  )

  console.log(viewList.value.map(v => v.uniqueKey))

  if (view) {
    if (!inBackground) {
      viewStack = viewStack.filter(i => i !== view.viewId)
    }
    view.props = props
  } else {
    view = {
      component,
      title: name,
      name,
      meta: {},
      props: toRef(props),
      uniqueKey: toRef(uniqueKey),
      parentViewId,
      viewId: ++nextId,
      hooks: {
        onActivate: undefined, onDeactivate: undefined, onBeforeClose: undefined
      }
    }
    viewList.value.push(view)
    hookIndex = viewList.value.length - 1
    nextTick().then(() => { hookIndex = undefined })
  }
  if (!inBackground) {
    currentView.value = view.viewId
    viewStack.unshift(currentView.value)
  }
  return view.viewId
}

/**
 *
 * @param {Number} viewId - view id to activate
 * @param {Boolean} force - activate even if the callbacks failed
 */
export async function activateView (viewId = ZERO_VIEW_ID, force = false) {
  currentView.value = viewId
  if (force && currentView.value !== viewId && viewList.value.some(v => v.viewId === viewId)) {
    _currentView.value = viewId
  }
}

/**
 * try co close all descendant views recursively and then view with specified id
 * @param {Number} viewId
 * @returns {Boolean} true if closed successfully
 */
export async function closeView (viewId) {
  const viewIndex = viewList.value.findIndex(v => v.viewId === viewId)
  if (viewIndex === -1) return true

  const view = viewList.value[viewIndex]
  const { hooks: { onBeforeClose = () => true } } = view
  const res = await onBeforeClose()
  if (res === false) {
    return false
  }

  // try to close all descendants
  if (!closeDescendantViews(viewId)) {
    return false
  }

  viewStack = viewStack.filter(i => i !== viewId)
  if (_currentView.value === viewId) {
    _currentView.value = viewStack[0] ?? ZERO_VIEW_ID
  }
  viewList.value.splice(viewIndex, 1)
  return true
}

/**
 * try co close all descendant views recursively
 * @param {Number} viewId
 * @returns {Boolean} true if closed successfully
 */
export function closeDescendantViews (viewId) {
  viewList.value.filter(({ parentViewId }) => parentViewId === viewId).reduce((acc, { viewId }) => acc && closeView(viewId), true)
}

/**
 * try co close all views recursively
 * @returns {Boolean} true if closed successfully
 */
export function closeAllViews () {
  return viewList.value.reduce((acc, { viewId }) => acc && closeView(viewId), true)
  // viewStack = []
  // currentView.value = ZERO_VIEW_ID
}

const MdiViewComponent = defineComponent({
  name: 'MdiView',
  props: {
    group: String,
    hideStyle: { type: Object, default: () => ({ display: 'none' }) },
    showStyle: { type: Object }
  },
  setup (props, { slots }) {
    return () => {
      const defaultVNodes = slots.default().map(vNode => ({ vNode, show: currentView.value === ZERO_VIEW_ID }))
      const vNodes = [...defaultVNodes, ...viewList.value.map(({ component, props, viewId }) => ({ vNode: h(component, { ...props, key: viewId }), show: currentView.value === viewId }))]
      return vNodes.map(({ vNode, show }) =>
        !show ? cloneVNode(vNode, { style: props.hideStyle }) : props.showStyle ? cloneVNode(vNode, { style: props.showStyle }) : vNode
      )
    }
  }
})

export const createMdiInterface = {
  install (app, { zeroId = 0, views } = {}) {
    app.component('MdiView', MdiViewComponent)
    ZERO_VIEW_ID = zeroId
    currentView.value = zeroId
    Object.assign(possibleViews, views)
  }
}
