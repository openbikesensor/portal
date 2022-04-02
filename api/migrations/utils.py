import sqlalchemy as sa


def dbtype(name):
    """
    Create a UserDefinedType for use in migrations as the type of a column,
    when the type already exists in the database, but isn't available as a
    proper sqlalchemy type.
    """

    class TheType(sa.types.UserDefinedType):
        def get_col_spec(self):
            return name

    TheType.__name__ = name
    return TheType
