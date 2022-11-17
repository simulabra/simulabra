import Base from './base';
import uWS from 'uWebSockets.js';

const _$HTML = Base.Interface.new({
  _inherits: [
    Base.$ToString,
  ],
  _protocol: [
    Base.Message.new({
      _name: $$`tag`
    })
  ]
})
const _$Page = Base.Interface.new({
  _protocol: [
    Base.Message.new({
      _name: $$`render`,
      _ret: _$HTML,
    }),
    Base.Message.new({
      _name: $$`route`,
      _ret: _String,
    })
  ],
});
const _WebApp = Base.Class.new({
  _slots: {
    uWSApp: Base.Var.new(),
    pages: Base.Var.new({
      // type: Base.$List.of(_$Page)
    }),
    init() {
      this.uWSApp(uWS.App());
      for (let page of this.pages()) {
        this.uWSApp().get('/' + page.route(), (res, req) => {
          page.render();
        });
      }
    },
  },
});
