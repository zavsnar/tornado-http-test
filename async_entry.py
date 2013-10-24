import os
import json

import redis
import tornadoredis
import tornado.web
import tornado.gen
import tornado.escape
from tornado import httpserver, ioloop, web
from tornado.options import define, options, parse_command_line

define("port", default=8080, help="run on the given port", type=int)

c = tornadoredis.Client()
c.connect()

class HomeHandler(web.RequestHandler):
    @tornado.web.asynchronous
    @tornado.gen.coroutine
    def get(self):
        # self.write('Hello!')
        all_keys = yield tornado.gen.Task(c.keys, 'id:*')
        all_keys = all_keys.split()
        # c.delete(all_keys)
        print all_keys
        all_values = yield tornado.gen.Task(c.mget, all_keys)
        print all_values
        all_values = map(lambda x: tornado.escape.json_decode(x), all_values)
        entries = zip(all_keys, all_values)
        self.set_header('Content-Type', 'text/html')
        self.render("template.html", title="Simple demo", entries=entries)

class Entry(object):
    def __init__(self):
        self.waiters = set()

    def add_waiter(self, callback):
        self.waiters.add(callback)

    def pub_new_message(self, key):
        for callback in self.waiters:
            callback(key)

global_entry = Entry()

class SetHandler(web.RequestHandler):
    @tornado.web.asynchronous
    @tornado.gen.coroutine
    def post(self):
        key = self.get_argument('key')
        value = self.get_argument('value')
        yield tornado.gen.Task(c.set, key, value)

        global_entry.pub_new_message(key)

class UpdateHandler(web.RequestHandler):
    @tornado.web.asynchronous
    def post(self):
        global_entry.add_waiter(self.on_new_entry)

    @tornado.gen.coroutine
    def on_new_entry(self, key):
        # Closed client connection
        if self.request.connection.stream.closed():
            return
        value = yield tornado.gen.Task(c.get, key)
        entry = {
            'key': key,
            'value': value
        }
        entry['html'] = tornado.escape.to_basestring(
            self.render_string("entry.html", key=key, value=value))
        self.finish(entry)


@tornado.gen.engine
def create_test_data():
    # c = tornadoredis.Client()
    with c.pipeline() as pipe:
        pipe.set('id:1', json.dumps(
            {'title':'yandex', 'customers_id': ['c:1', 'c:2']}), 12 * 60 * 60)
        pipe.set('id:2', json.dumps(
            {'title':'google', 'customers_id': ['c:3', 'c:4', 'c:5']}), 12 * 60 * 60)
        yield tornado.gen.Task(pipe.execute)
    print 'Test data initialization completed.'

url_map = (
    (r'^/$', HomeHandler),
    (r'^/set$', SetHandler),
    (r'^/update$', UpdateHandler),
)

if __name__ == "__main__":
    create_test_data()
    parse_command_line()
    app = web.Application(
        handlers=url_map,
        # template_path=os.path.join(os.path.dirname(__file__), "templates"),
        static_path = os.path.join(os.path.dirname(__file__), "static"),
    )
    http_server = httpserver.HTTPServer(app)
    http_server.listen(options.port)
    ioloop.IOLoop.instance().start()