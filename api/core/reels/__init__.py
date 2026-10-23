"""Vernacular Reel generation: script → voice → captions → render. Used by the worker."""


class ReelJobError(Exception):
    """A Reel job failed. The message is safe to show to sellers."""
