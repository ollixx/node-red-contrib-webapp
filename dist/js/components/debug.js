Vue.component('GuiDebug', {
  mixins: [GuiMixin],
  template:
`
<pre>{{getModel()}}</pre>
`
});
