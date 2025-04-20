from smol.settings import *  # import all the normal settings

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# speed up password hashing, migrations, etc. if you like
PASSWORD_HASHERS = ("django.contrib.auth.hashers.MD5PasswordHasher",)
