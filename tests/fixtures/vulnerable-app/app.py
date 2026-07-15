# Fixture: insecure Python patterns.
import requests


def run(user_input):
    return eval(user_input)


def get_user(cursor, name):
    cursor.execute(f"SELECT * FROM users WHERE name = {name}")


def fetch(url):
    return requests.get(url, verify=False)
