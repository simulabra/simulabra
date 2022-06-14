let module = [
{
  is: 'Class',
  $name: 'ArticleCategory',
  slots: {
    name: 'String',
    children: { is: 'List', of: 'ArticleCategory' },
  }
}, {
  is: 'Class',
  $name: 'Article',
  slots: {
    url: 'URL',
    saved: 'Date',
    category: '?ArticleCategory',
  }
}, {
  is: 'Method',
  self: 'Article',
  arg: 'ArticleCategory',
  $do: ['@', 'category', 'it'],
}];

/*
 * put together lessons from operat - compilation and lispiness alongside
 * endo and an object system and you have something cooking.
 */
