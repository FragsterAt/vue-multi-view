# vue-multiview

library to handle many vue components like tabs in browser

Compatible with vue-router

Online demo: https://mdi.fragster.ru/
Demo source code: https://github.com/FragsterAt/mdi-interface-demo

## Installation
```bash
yarn add vue-multiview
# or
npm install vue-multiview
```

## Usage

### Create object with available 'views'

```javascript
const views = {
  counter: {
    meta: { icon: 'calculate' }, // any meta info
    component: () => import('pages/CounterView.vue')
  },
  image: {
    title: 'Image view', // default title of view (if not specified - this is key of view)
    component: () => import('pages/ImageView.vue')
  },
  entity: () => import('pages/EntityView.vue') // if all controlled by view component, you can pass only import
}
```

### Add plugin to vue app

```javascript
import { createApp } from 'vue'
import { createMultiView } from 'vue-mdi-interface'

import App from './App.vue'

const app = createApp(App)

app.use(createMultiView, { views })

app.mount('#app')
```

### Add component to show content of views

```html
<mdi-view>
    <!-- default content, if current view is not specified-->
    <router-view /> <!-- for example it can be router-->
</mdi-view>
```

### Add component to switch between views

Here is example with [Quasar](https://quasar.dev/) but you can use lib with any vue-based framework or even without framework at all
```html
<template>
  <q-tabs v-model="currentView" align="left" inline-label>
    <q-tab :name="ZERO_VIEW_ID" icon="home" label="Router" />
    <q-tab :name="view.viewId" :icon="view.meta.icon" v-for="view in viewList" :key="view.viewId">{{
      view.title }} <q-btn round flat @click.stop="closeView(view.viewId)" icon="delete" dense></q-btn></q-tab>
  </q-tabs>
</template>

<script setup>
import { viewList, currentView, closeView, ZERO_VIEW_ID } from 'src/vue-mdi-interface'

</script>
```

### Open view

Simple open view (or activate if it is opened)
```javascript

```

### Register callbacks

### Change view properties

### Close view

## API

### Plugin options


```javascript
app.use(createMultiView, {
  componentName: 'MultiView', // Optional, this is default value
  views // Object with views definitions, required!
})
```

view definition:

key of object will be the view name, used in openView function
```javascript
const views = {
  view1: {
    title: 'Image view', // Optional, default value is the name of view. May be changed in view component
    meta: { icon: 'calculate' },
    component: () => import('pages/CounterView.vue')
  },
  view2: () => import('pages/EntityView.vue')
}
```

